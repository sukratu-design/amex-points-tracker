// Main app logic - points calculation and UI
import {
    addTransaction as dbAddTransaction,
    deleteTransaction as dbDeleteTransaction,
    clearAllTransactions,
    importTransactions,
    subscribeToTransactions,
    onSyncStatusChange,
    getLocalTransactions
} from './db.js'
import { isFirebaseConfigured } from './firebase.js'

// Card configuration
export const CARDS = {
    metal: {
        name: 'Charge Metal',
        pointsPerRupee: 1 / 40,
        internationalMultiplier: 3,
        noPointsCategories: ['fuel', 'insurance', 'utilities']
    },
    travel: {
        name: 'Platinum Travel',
        pointsPerRupee: 1 / 50,
        internationalMultiplier: 1,
        noPointsCategories: ['fuel', 'insurance', 'utilities'],
        milestones: [
            { spend: 190000, bonusPoints: 15000 },
            { spend: 400000, bonusPoints: 25000 }
        ]
    }
}

// State
let transactions = []
let currentFilter = 'all'
let unsubscribe = null

// Initialize app
export function initApp() {
    document.getElementById('date').valueAsDate = new Date()
    setupEventListeners()
    setupSyncStatus()

    // Load initial data from localStorage while waiting for Firebase
    transactions = getLocalTransactions()
    updateDisplay()
}

// Start listening to transactions (call after auth)
export function startTransactionSync() {
    if (unsubscribe) {
        unsubscribe()
    }

    showLoading(true)

    unsubscribe = subscribeToTransactions((data) => {
        transactions = data
        updateDisplay()
        showLoading(false)
    })
}

// Stop listening to transactions (call on sign out)
export function stopTransactionSync() {
    if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
    }
    // Load local data
    transactions = getLocalTransactions()
    updateDisplay()
}

function showLoading(show) {
    const loader = document.getElementById('loadingSpinner')
    const content = document.getElementById('mainContent')
    if (loader && content) {
        loader.style.display = show ? 'flex' : 'none'
        content.style.display = show ? 'none' : 'block'
    }
}

function setupSyncStatus() {
    onSyncStatusChange((status, message) => {
        const statusEl = document.getElementById('syncStatus')
        if (!statusEl) return

        statusEl.className = 'sync-status ' + status

        switch (status) {
            case 'syncing':
                statusEl.innerHTML = '<span class="spinner-small"></span> Syncing...'
                break
            case 'synced':
                statusEl.innerHTML = '&#10003; Synced'
                break
            case 'error':
                statusEl.innerHTML = '&#10007; Sync error'
                statusEl.title = message
                break
            default:
                statusEl.innerHTML = ''
        }
    })
}

function setupEventListeners() {
    // Form submission
    document.getElementById('transactionForm').addEventListener('submit', handleSubmit)

    // Tab filtering for categories
    document.querySelectorAll('.section').forEach(section => {
        section.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const parent = e.target.closest('.tabs')
                parent.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
                e.target.classList.add('active')
                currentFilter = e.target.dataset.filter
                updateDisplay()
            })
        })
    })

    // Export/Import/Clear buttons
    document.getElementById('exportBtn')?.addEventListener('click', exportData)
    document.getElementById('importBtn')?.addEventListener('click', () => {
        document.getElementById('importFile').click()
    })
    document.getElementById('importFile')?.addEventListener('change', handleImport)
    document.getElementById('clearBtn')?.addEventListener('click', handleClearAll)
}

async function handleSubmit(e) {
    e.preventDefault()

    const transaction = {
        card: document.getElementById('card').value,
        amount: parseFloat(document.getElementById('amount').value),
        category: document.getElementById('category').value,
        date: document.getElementById('date').value,
        description: document.getElementById('description').value
    }

    // Calculate points
    transaction.points = calculatePoints(transaction)

    // Disable submit button temporarily
    const submitBtn = e.target.querySelector('button[type="submit"]')
    submitBtn.disabled = true

    try {
        await dbAddTransaction(transaction)
    } catch (error) {
        console.error('Error adding transaction:', error)
    } finally {
        submitBtn.disabled = false
    }

    // Reset form
    document.getElementById('amount').value = ''
    document.getElementById('description').value = ''
    document.getElementById('amount').focus()
}

export function calculatePoints(transaction) {
    const card = CARDS[transaction.card]

    // No points for excluded categories
    if (card.noPointsCategories.includes(transaction.category)) {
        return 0
    }

    let multiplier = 1
    if (transaction.category === 'international') {
        multiplier = card.internationalMultiplier
    }

    return Math.floor(transaction.amount * card.pointsPerRupee * multiplier)
}

function calculateMilestoneBonus(cardType) {
    if (cardType !== 'travel') return 0

    const card = CARDS.travel
    const totalSpend = transactions
        .filter(t => t.card === 'travel')
        .reduce((sum, t) => sum + t.amount, 0)

    let bonus = 0
    for (const milestone of card.milestones) {
        if (totalSpend >= milestone.spend) {
            bonus = milestone.bonusPoints
        }
    }
    return bonus
}

function updateDisplay() {
    updatePointsSummary()
    updateCategoryBreakdown()
    updateTransactionsList()
}

function updatePointsSummary() {
    // Metal card
    const metalTx = transactions.filter(t => t.card === 'metal')
    const metalPoints = metalTx.reduce((sum, t) => sum + (t.points || 0), 0)
    const metalSpend = metalTx.reduce((sum, t) => sum + t.amount, 0)

    document.getElementById('metalPoints').textContent = metalPoints.toLocaleString('en-IN')
    document.getElementById('metalSpend').textContent = '₹' + metalSpend.toLocaleString('en-IN')

    // Travel card
    const travelTx = transactions.filter(t => t.card === 'travel')
    const travelBasePoints = travelTx.reduce((sum, t) => sum + (t.points || 0), 0)
    const travelSpend = travelTx.reduce((sum, t) => sum + t.amount, 0)
    const milestoneBonus = calculateMilestoneBonus('travel')
    const travelTotalPoints = travelBasePoints + milestoneBonus

    document.getElementById('travelPoints').textContent = travelTotalPoints.toLocaleString('en-IN')
    document.getElementById('travelSpend').textContent = '₹' + travelSpend.toLocaleString('en-IN')

    // Milestone progress
    const milestoneTarget = 190000
    const progress = Math.min((travelSpend / milestoneTarget) * 100, 100)
    document.getElementById('milestoneProgress').textContent = '₹' + travelSpend.toLocaleString('en-IN')
    document.getElementById('milestoneFill').style.width = progress + '%'
}

function updateCategoryBreakdown() {
    const filtered = currentFilter === 'all'
        ? transactions
        : transactions.filter(t => t.card === currentFilter)

    const categories = {}
    filtered.forEach(t => {
        if (!categories[t.category]) {
            categories[t.category] = { amount: 0, points: 0 }
        }
        categories[t.category].amount += t.amount
        categories[t.category].points += (t.points || 0)
    })

    const container = document.getElementById('categoryBreakdown')
    if (Object.keys(categories).length === 0) {
        container.innerHTML = '<div class="empty-state">No data to display</div>'
        return
    }

    container.innerHTML = Object.entries(categories)
        .sort((a, b) => b[1].amount - a[1].amount)
        .map(([cat, data]) => `
            <div class="category-item">
                <div class="name">${formatCategory(cat)}</div>
                <div class="amount">₹${data.amount.toLocaleString('en-IN')}</div>
                <div class="name">${data.points.toLocaleString('en-IN')} pts</div>
            </div>
        `).join('')
}

function updateTransactionsList() {
    const filtered = currentFilter === 'all'
        ? transactions
        : transactions.filter(t => t.card === currentFilter)

    const container = document.getElementById('transactionsContainer')

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">No transactions yet.</div>'
        return
    }

    container.innerHTML = `
        <table class="transactions-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Card</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th style="text-align: right">Amount</th>
                    <th style="text-align: right">Points</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                ${filtered.map(t => `
                    <tr>
                        <td>${formatDate(t.date)}</td>
                        <td><span class="card-tag ${t.card}">${CARDS[t.card].name}</span></td>
                        <td><span class="category-tag ${getCategoryClass(t.category)}">${formatCategory(t.category)}</span></td>
                        <td>${t.description || '-'}</td>
                        <td style="text-align: right">₹${t.amount.toLocaleString('en-IN')}</td>
                        <td style="text-align: right" class="points-earned ${(t.points || 0) === 0 ? 'zero' : ''}">${(t.points || 0).toLocaleString('en-IN')}</td>
                        <td><button class="delete-btn" data-id="${t.id}"><span class="delete-icon">×</span><span class="delete-label"> Delete</span></button></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `

    // Add delete handlers
    container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => handleDelete(btn.dataset.id))
    })
}

function formatCategory(cat) {
    const names = {
        dining: 'Dining',
        travel: 'Travel',
        shopping: 'Shopping',
        groceries: 'Groceries',
        entertainment: 'Entertainment',
        international: 'International',
        fuel: 'Fuel',
        insurance: 'Insurance',
        utilities: 'Utilities',
        other: 'Other'
    }
    return names[cat] || cat
}

function getCategoryClass(cat) {
    if (['fuel', 'insurance', 'utilities'].includes(cat)) return 'no-points'
    if (cat === 'international') return 'intl'
    return ''
}

function formatDate(dateStr) {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

async function handleDelete(id) {
    if (confirm('Delete this transaction?')) {
        await dbDeleteTransaction(id)
    }
}

function exportData() {
    const data = JSON.stringify(transactions, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `amex-points-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
}

async function handleImport(event) {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
        try {
            const imported = JSON.parse(e.target.result)
            if (Array.isArray(imported)) {
                const count = await importTransactions(imported)
                alert(`Imported ${count} transactions`)
            }
        } catch (err) {
            alert('Invalid file format')
        }
    }
    reader.readAsText(file)
    event.target.value = ''
}

async function handleClearAll() {
    if (confirm('Are you sure you want to delete all transactions? This cannot be undone.')) {
        await clearAllTransactions()
        transactions = []
        updateDisplay()
    }
}
