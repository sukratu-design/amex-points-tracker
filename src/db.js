// Firestore database operations
import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    query,
    orderBy,
    serverTimestamp,
    onSnapshot
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase.js'
import { getCurrentUser } from './auth.js'

// Local storage key
const LOCAL_STORAGE_KEY = 'amexTransactions'

// Sync status callback
let syncStatusCallback = null
let unsubscribeSnapshot = null

export function onSyncStatusChange(callback) {
    syncStatusCallback = callback
}

function updateSyncStatus(status, message = '') {
    if (syncStatusCallback) {
        syncStatusCallback(status, message)
    }
}

// Get user's transactions collection path
function getUserTransactionsRef() {
    const user = getCurrentUser()
    if (!user || !isFirebaseConfigured() || !db) {
        return null
    }
    return collection(db, 'users', user.uid, 'transactions')
}

// Load transactions from Firestore
export async function loadTransactions() {
    const collectionRef = getUserTransactionsRef()

    if (!collectionRef) {
        // Fallback to localStorage
        return loadFromLocalStorage()
    }

    try {
        updateSyncStatus('syncing')
        const q = query(collectionRef, orderBy('createdAt', 'desc'))
        const snapshot = await getDocs(q)

        const transactions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }))

        // Also save to localStorage as backup
        saveToLocalStorage(transactions)
        updateSyncStatus('synced')

        return transactions
    } catch (error) {
        console.error('Error loading transactions:', error)
        updateSyncStatus('error', error.message)
        // Fallback to localStorage
        return loadFromLocalStorage()
    }
}

// Subscribe to real-time updates
export function subscribeToTransactions(callback) {
    const collectionRef = getUserTransactionsRef()

    if (!collectionRef) {
        // Offline mode - just return localStorage data
        callback(loadFromLocalStorage())
        return () => {}
    }

    // Unsubscribe from previous listener
    if (unsubscribeSnapshot) {
        unsubscribeSnapshot()
    }

    try {
        const q = query(collectionRef, orderBy('createdAt', 'desc'))
        unsubscribeSnapshot = onSnapshot(q,
            (snapshot) => {
                const transactions = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                saveToLocalStorage(transactions)
                updateSyncStatus('synced')
                callback(transactions)
            },
            (error) => {
                console.error('Snapshot error:', error)
                updateSyncStatus('error', error.message)
                callback(loadFromLocalStorage())
            }
        )

        return () => {
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot()
                unsubscribeSnapshot = null
            }
        }
    } catch (error) {
        console.error('Subscribe error:', error)
        callback(loadFromLocalStorage())
        return () => {}
    }
}

// Add a new transaction
export async function addTransaction(transaction) {
    const collectionRef = getUserTransactionsRef()

    // Add to localStorage immediately for responsiveness
    const localTransactions = loadFromLocalStorage()
    const localTransaction = {
        ...transaction,
        id: transaction.id || Date.now().toString(),
        createdAt: new Date().toISOString()
    }
    localTransactions.unshift(localTransaction)
    saveToLocalStorage(localTransactions)

    if (!collectionRef) {
        return localTransaction
    }

    try {
        updateSyncStatus('syncing')
        const docRef = await addDoc(collectionRef, {
            ...transaction,
            createdAt: serverTimestamp()
        })
        updateSyncStatus('synced')
        return { ...transaction, id: docRef.id }
    } catch (error) {
        console.error('Error adding transaction:', error)
        updateSyncStatus('error', error.message)
        return localTransaction
    }
}

// Delete a transaction
export async function deleteTransaction(transactionId) {
    // Remove from localStorage immediately
    const localTransactions = loadFromLocalStorage()
    const filtered = localTransactions.filter(t => t.id !== transactionId)
    saveToLocalStorage(filtered)

    const collectionRef = getUserTransactionsRef()
    if (!collectionRef) {
        return true
    }

    try {
        updateSyncStatus('syncing')
        await deleteDoc(doc(collectionRef, transactionId))
        updateSyncStatus('synced')
        return true
    } catch (error) {
        console.error('Error deleting transaction:', error)
        updateSyncStatus('error', error.message)
        return false
    }
}

// Clear all transactions
export async function clearAllTransactions() {
    // Clear localStorage
    saveToLocalStorage([])

    const collectionRef = getUserTransactionsRef()
    if (!collectionRef) {
        return true
    }

    try {
        updateSyncStatus('syncing')
        const snapshot = await getDocs(collectionRef)
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref))
        await Promise.all(deletePromises)
        updateSyncStatus('synced')
        return true
    } catch (error) {
        console.error('Error clearing transactions:', error)
        updateSyncStatus('error', error.message)
        return false
    }
}

// Import transactions (merge with existing)
export async function importTransactions(transactions) {
    const collectionRef = getUserTransactionsRef()

    // Add to localStorage
    const localTransactions = loadFromLocalStorage()
    const newTransactions = transactions.map(t => ({
        ...t,
        id: t.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
        createdAt: t.createdAt || new Date().toISOString()
    }))
    saveToLocalStorage([...newTransactions, ...localTransactions])

    if (!collectionRef) {
        return newTransactions.length
    }

    try {
        updateSyncStatus('syncing')
        const addPromises = transactions.map(t =>
            addDoc(collectionRef, {
                ...t,
                createdAt: serverTimestamp()
            })
        )
        await Promise.all(addPromises)
        updateSyncStatus('synced')
        return transactions.length
    } catch (error) {
        console.error('Error importing transactions:', error)
        updateSyncStatus('error', error.message)
        return transactions.length // Still added to localStorage
    }
}

// Local storage helpers
function loadFromLocalStorage() {
    try {
        const data = localStorage.getItem(LOCAL_STORAGE_KEY)
        return data ? JSON.parse(data) : []
    } catch {
        return []
    }
}

function saveToLocalStorage(transactions) {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(transactions))
    } catch (error) {
        console.error('Error saving to localStorage:', error)
    }
}

// Export for offline access
export function getLocalTransactions() {
    return loadFromLocalStorage()
}
