// Enhanced signup.js with Google OAuth
import { auth, db } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.8.1/dist/ethers.min.js";

// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Utility function to create wallet and save user data
async function createUserWalletAndData(user, username, isGoogleAuth = false) {
  try {
    console.log("Creating wallet for user:", user.uid);

    // Create wallet
    const wallet = ethers.Wallet.createRandom();
    const walletAddress = wallet.address;
    const privateKey = wallet.privateKey;

    console.log("✅ Wallet created:", walletAddress);

    // Save user data
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      username: username || user.displayName || user.email.split('@')[0],
      walletAddress: walletAddress,
      privateKey: privateKey,
      bonusGiven: false,
      createdAt: serverTimestamp(),
      lastCheckIn: null,
      emailVerified: isGoogleAuth ? true : user.emailVerified, // Google emails are pre-verified
      authProvider: isGoogleAuth ? 'google' : 'email',
      photoURL: user.photoURL || null
    });

    console.log("✅ User data saved");

    return { walletAddress, privateKey, username: username || user.displayName || user.email.split('@')[0] };

  } catch (error) {
    console.error("❌ Error creating wallet/user data:", error);
    throw error;
  }
}

// Utility function to download private key
function downloadPrivateKey(username, email, walletAddress, privateKey) {
  try {
    const keyData = `S2 Wallet Private Key
=====================
Username: ${username}
Email: ${email}
Wallet Address: ${walletAddress}
Private Key: ${privateKey}

⚠️ KEEP THIS SAFE!
- Never share this private key
- Store it securely
- You need it to access your wallet`;

    const blob = new Blob([keyData], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `S2Wallet_${username}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
  } catch (downloadError) {
    // Fallback: show private key in alert
    alert(`IMPORTANT: Save your private key!

${privateKey}

Write this down safely - you need it to access your wallet!`);
  }
}

// Google Sign Up Handler
document.getElementById('googleSignupBtn').addEventListener('click', async () => {
  const googleBtn = document.getElementById('googleSignupBtn');
  
  try {
    console.log("Starting Google signup...");
    console.log("Current domain:", window.location.hostname);
    
    // Show loading state
    googleBtn.classList.add('loading');
    googleBtn.textContent = 'Signing up with Google';

    // Configure Google provider with additional settings
    googleProvider.setCustomParameters({
      prompt: 'select_account'
    });

    // Sign in with Google
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    console.log("✅ Google auth successful:", user.uid);

    // Check if user already exists in our database
    const userDoc = await getDoc(doc(db, "users", user.uid));
    
    if (userDoc.exists()) {
      // User already exists, redirect to login/dashboard
      alert(`Welcome back, ${user.displayName}! You already have an account. Redirecting to login...`);
      setTimeout(() => {
        window.location.href = "login.html";
      }, 2000);
      return;
    }

    // New Google user - create wallet and save data
    const { walletAddress, privateKey, username } = await createUserWalletAndData(user, null, true);

    // Show success message
    alert(`🎉 Google Account Created Successfully!

Username: ${username}
Email: ${user.email}
Wallet: ${walletAddress}

✅ Your email is already verified with Google!

Your private key will download now.`);

    // Download private key
    downloadPrivateKey(username, user.email, walletAddress, privateKey);

    // Redirect to login/dashboard
    setTimeout(() => {
      window.location.href = "login.html";
    }, 3000);

  } catch (error) {
    console.error("❌ Google signup failed:", error);
    console.log("Error details:", {
      code: error.code,
      message: error.message,
      domain: window.location.hostname
    });
    
    let message = "";
    
    switch (error.code) {
      case "auth/unauthorized-domain":
        message = `🚫 Domain Authorization Error
        
Current domain: ${window.location.hostname}

To fix this:
1. Go to Firebase Console → Authentication → Settings → Authorized domains
2. Add "${window.location.hostname}" to the authorized domains list
3. Also add "localhost" and "127.0.0.1" for local development

Then try again!`;
        break;
      case "auth/popup-closed-by-user":
        message = "Google sign-up was cancelled. Please try again.";
        break;
      case "auth/popup-blocked":
        message = "Pop-up blocked! Please allow pop-ups for this site and try again.";
        break;
      case "auth/cancelled-popup-request":
        message = "Only one sign-up attempt at a time. Please try again.";
        break;
      case "auth/network-request-failed":
        message = "Network error. Please check your connection and try again.";
        break;
      default:
        message = `Google sign-up failed: ${error.message}
        
If you're seeing an unauthorized domain error, please add "${window.location.hostname}" to your Firebase authorized domains.`;
    }
    
    alert(message);
    
  } finally {
    // Reset button state
    googleBtn.classList.remove('loading');
    googleBtn.innerHTML = '<div class="google-icon">G</div>Sign up with Google';
  }
});

// Email Sign Up Handler (existing functionality)
document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const username = document.getElementById('username').value.trim();
  const submitBtn = e.target.querySelector('button[type="submit"]');

  try {
    console.log("Starting email signup for:", email);

    // Show loading state
    submitBtn.classList.add('loading');
    submitBtn.textContent = 'Creating Account';

    // 1. Create user account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log("✅ User created:", user.uid);

    // 2. Update profile
    await updateProfile(user, {
      displayName: username
    });

    // 3. Create wallet and save user data
    const { walletAddress, privateKey } = await createUserWalletAndData(user, username, false);

    // 4. Send verification email
    try {
      console.log("Sending verification email...");
      
      await sendEmailVerification(user);
      
      console.log("✅ Verification email sent!");
      
      alert(`🎉 Account Created Successfully!

Username: ${username}
Email: ${email}
Wallet: ${walletAddress}

📧 A verification email has been sent to ${email}

Next steps:
1. Check your email inbox AND spam folder
2. Click the verification link in the email
3. Come back and log in

Your private key will download now.`);

    } catch (emailError) {
      console.error("❌ Email send failed:", emailError);
      
      // Account was created successfully, just email failed
      alert(`✅ Account Created Successfully!

Username: ${username}
Email: ${email}
Wallet: ${walletAddress}

⚠️ Note: Couldn't send verification email automatically.
Error: ${emailError.message}

You can:
1. Try the "Resend Email" button on the login page
2. Contact support if needed

Your private key will download now.`);
    }

    // 5. Download private key
    downloadPrivateKey(username, email, walletAddress, privateKey);

    // 6. Redirect to login
    setTimeout(() => {
      window.location.href = "login.html";
    }, 3000);

  } catch (error) {
    console.error("❌ Email signup failed:", error);
    
    let message = "";
    
    switch (error.code) {
      case "auth/email-already-in-use":
        message = "This email is already registered. Redirecting to login...";
        setTimeout(() => window.location.href = "login.html", 2000);
        break;
      case "auth/invalid-email":
        message = "Please enter a valid email address.";
        break;
      case "auth/weak-password":
        message = "Password must be at least 6 characters long.";
        break;
      case "auth/operation-not-allowed":
        message = "Email signup is not enabled in Firebase.";
        break;
      default:
        message = `Signup failed: ${error.message}`;
    }
    
    alert(message);
    
  } finally {
    // Reset button state
    submitBtn.classList.remove('loading');
    submitBtn.textContent = 'Sign Up with Email';
  }
});