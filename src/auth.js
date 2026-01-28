// Authentication logic
import {
    signInWithPopup,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    onAuthStateChanged
} from 'firebase/auth'
import { auth, isFirebaseConfigured } from './firebase.js'

const provider = new GoogleAuthProvider()

// Current user state
let currentUser = null
let authStateCallback = null

// Sign in with Google
export async function signInWithGoogle() {
    if (!isFirebaseConfigured()) {
        console.warn('Firebase not configured. Running in offline mode.')
        return null
    }

    try {
        const result = await signInWithPopup(auth, provider)
        return result.user
    } catch (error) {
        console.error('Sign in error:', error)
        throw error
    }
}

// Sign out
export async function signOut() {
    if (!isFirebaseConfigured() || !auth) {
        return
    }

    try {
        await firebaseSignOut(auth)
    } catch (error) {
        console.error('Sign out error:', error)
        throw error
    }
}

// Get current user
export function getCurrentUser() {
    return currentUser
}

// Listen to auth state changes
export function onAuthChange(callback) {
    authStateCallback = callback

    if (!isFirebaseConfigured() || !auth) {
        // Offline mode - no user
        callback(null)
        return () => {}
    }

    return onAuthStateChanged(auth, (user) => {
        currentUser = user
        if (authStateCallback) {
            authStateCallback(user)
        }
    })
}

// Check if user is signed in
export function isSignedIn() {
    return currentUser !== null
}
