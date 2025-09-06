// Enhanced login.js with Google OAuth and Forgot Password
import { auth, db } from './firebase.js';
import {
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  reload,
  signInWithPopup,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.8.1/dist/ethers.min.js";

// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Utility function to create wallet for Google users (if needed)
async function createUserWalletAndData(user) {
  try {
    console.log("Creating wallet for Google user:", user.uid);

    // Create wallet
    const wallet = ethers.Wallet.createRandom();
    const walletAddress = wallet.address;
    const privateKey = wallet.privateKey;

    console.log("✅ Wallet created:", walletAddress);

    // Save user data
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      username: user.displayName || user.email.split('@')[0],
      walletAddress: walletAddress,
      privateKey: privateKey,
      bonusGiven: false,
      createdAt: serverTimestamp(),
      lastCheckIn: null,
      emailVerified: true, // Google emails are pre-verified
      authProvider: 'google',
      photoURL: user.photoURL || null
    });

    console.log("✅ Google user data saved");
    return { walletAddress, privateKey, username: user.displayName || user.email.split('@')[0] };

  } catch (error) {
    console.error("❌ Error creating wallet/user data:", error);
    throw error;
  }
}

// Utility function to handle successful login
async function handleSuccessfulLogin(user, userData) {
  try {
    // Handle bonus tokens (if not already given)
    if (!userData.bonusGiven) {
      console.log("Attempting to send bonus tokens...");
      
      try {
        const response = await fetch("https://my-backend-gs60.onrender.com/bonus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: userData.walletAddress })
        });

        if (response.ok) {
          const result = await response.json();
          
          if (result.success) {
            console.log("✅ Bonus tokens sent!");
            await updateDoc(doc(db, "users", user.uid), { bonusGiven: true });
            
            alert(`🎉 Welcome back, ${userData.username}!

25 S2 Tokens have been sent to your wallet as a welcome bonus!

Wallet: ${userData.walletAddress}`);
          } else {
            console.log("❌ Bonus API returned error:", result.error);
            alert(`Welcome back, ${userData.username}!

Note: There was an issue sending your bonus tokens. Please contact support.`);
          }
        } else {
          console.log("❌ Bonus API request failed");
          alert(`Welcome back, ${userData.username}!

Note: Bonus token service is currently unavailable.`);
        }
      } catch (bonusError) {
        console.error("❌ Bonus request failed:", bonusError);
        // Don't block login for bonus issues
        alert(`Welcome back, ${userData.username}!

Note: Unable to connect to bonus token service.`);
      }
    } else {
      alert(`Welcome back, ${userData.username}!`);
    }

    // Redirect to dashboard
    console.log("✅ Login complete, redirecting...");
    window.location.href = "dashboard.html";

  } catch (error) {
    console.error("❌ Error in handleSuccessfulLogin:", error);
    // Still redirect even if bonus fails
    alert(`Welcome back, ${userData.username}!`);
    window.location.href = "dashboard.html";
  }
}

// Google Login Handler
document.getElementById('googleLoginBtn').addEventListener('click', async () => {
  const googleBtn = document.getElementById('googleLoginBtn');
  
  try {
    console.log("Starting Google login...");
    
    // Show loading state
    googleBtn.classList.add('loading');
    googleBtn.textContent = 'Signing in with Google';

    // Configure Google provider
    googleProvider.setCustomParameters({
      prompt: 'select_account'
    });

    // Sign in with Google
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    console.log("✅ Google auth successful:", user.uid);

    // Check if user exists in our database
    const userDoc = await getDoc(doc(db, "users", user.uid));
    
    if (!userDoc.exists()) {
      // New Google user - create wallet and save data
      console.log("New Google user, creating wallet...");
      
      const { walletAddress, privateKey, username } = await createUserWalletAndData(user);

      // Show success message and offer private key download
      const shouldDownload = confirm(`🎉 Welcome to S2 App, ${username}!

Your account has been created with Google login.
Wallet: ${walletAddress}

Would you like to download your wallet's private key?

⚠️ IMPORTANT: This is your only chance to get the private key!
You need it to access your wallet outside of this app.

Click OK to download, or Cancel to continue without it.`);

      if (shouldDownload) {
        try {
          const keyData = `S2 Wallet Private Key
=====================
Username: ${username}
Email: ${user.email}
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
    }

    // Get updated user data
    const updatedUserDoc = await getDoc(doc(db, "users", user.uid));
    const userData = updatedUserDoc.data();

    // Update last login time
    await updateDoc(doc(db, "users", user.uid), { 
      lastLogin: serverTimestamp()
    });

    // Handle successful login
    await handleSuccessfulLogin(user, userData);

  } catch (error) {
    console.error("❌ Google login failed:", error);
    
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
        message = "Google login was cancelled. Please try again.";
        break;
      case "auth/popup-blocked":
        message = "Pop-up blocked! Please allow pop-ups for this site and try again.";
        break;
      case "auth/cancelled-popup-request":
        message = "Only one login attempt at a time. Please try again.";
        break;
      case "auth/network-request-failed":
        message = "Network error. Please check your connection and try again.";
        break;
      default:
        message = `Google login failed: ${error.message}`;
    }
    
    alert(message);
    
  } finally {
    // Reset button state
    googleBtn.classList.remove('loading');
    googleBtn.innerHTML = '<img class="google-icon" src="https://developers.google.com/identity/images/g-logo.png" alt="Google logo" width="20" height="20">Continue with Google';
  }
});

// Email Login Handler
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const submitBtn = e.target.querySelector('button[type="submit"]');

  try {
    console.log("Attempting login for:", email);
    
    // Show loading state
    submitBtn.classList.add('loading');
    submitBtn.textContent = 'Signing In';

    // 1. Sign in user
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    console.log("✅ Login successful, checking email verification...");

    // 2. Refresh user data to get latest email verification status
    await reload(user);

    // 3. Check if email is verified
    if (!user.emailVerified) {
      console.log("❌ Email not verified");
      
      const shouldResend = confirm(`Your email address is not verified yet.

Please check your email for a verification link.

Would you like us to send another verification email?

Click OK to resend, or Cancel to try again later.`);

      if (shouldResend) {
        try {
          console.log("Resending verification email...");
          
          // Send simple verification email
          await sendEmailVerification(user);
          
          alert(`📧 Verification email sent to ${email}!

Please:
1. Check your email inbox and spam folder
2. Click the verification link
3. Return here and try logging in again

The email should arrive within a few minutes.`);
          
        } catch (emailError) {
          console.error("❌ Resend failed:", emailError);
          
          let errorMsg = "Failed to send verification email.";
          
          if (emailError.code === 'auth/too-many-requests') {
            errorMsg = "Too many email requests. Please wait a few minutes before trying again.";
          } else {
            errorMsg = `Email send failed: ${emailError.message}`;
          }
          
          alert(errorMsg);
        }
      }

      // Sign out unverified user
      await auth.signOut();
      return;
    }

    console.log("✅ Email verified, proceeding with login...");

    // 4. Get user data from Firestore
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      alert("User data not found. Please contact support.");
      await auth.signOut();
      return;
    }

    const userData = userSnap.data();
    
    // 5. Update verification status in Firestore
    if (!userData.emailVerified) {
      await updateDoc(userRef, { 
        emailVerified: true,
        lastLogin: serverTimestamp()
      });
    }

    // 6. Handle successful login
    await handleSuccessfulLogin(user, userData);

  } catch (error) {
    console.error("❌ Login error:", error);

    // Clear form
    emailInput.value = '';
    passwordInput.value = '';

    // Handle specific errors
    let message = "";
    
    switch (error.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        message = "Invalid email or password. Please check your credentials.";
        break;
      case "auth/invalid-email":
        message = "Please enter a valid email address.";
        break;
      case "auth/user-disabled":
        message = "This account has been disabled. Please contact support.";
        break;
      case "auth/too-many-requests":
        message = "Too many failed attempts. Please wait a few minutes and try again.";
        break;
      case "auth/network-request-failed":
        message = "Network error. Please check your connection.";
        break;
      default:
        message = `Login failed: ${error.message}`;
    }
    
    alert(message);
    
  } finally {
    // Reset button state
    submitBtn.classList.remove('loading');
    submitBtn.textContent = 'Log In';
  }
});

// Forgot Password Handler
document.getElementById('forgotPasswordLink').addEventListener('click', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value.trim();
  
  if (!email) {
    alert("Please enter your email address first, then click 'Forgot Password'.");
    document.getElementById('email').focus();
    return;
  }
  
  try {
    console.log("Sending password reset email to:", email);
    
    await sendPasswordResetEmail(auth, email);
    
    alert(`✅ Password reset email sent to ${email}!

Please:
1. Check your email inbox and spam folder
2. Click the password reset link
3. Follow the instructions to create a new password
4. Return here and log in with your new password

The email should arrive within a few minutes.`);
    
    console.log("✅ Password reset email sent successfully");
    
  } catch (error) {
    console.error("❌ Password reset failed:", error);
    
    let message = "";
    
    switch (error.code) {
      case "auth/user-not-found":
        message = "No account found with this email address. Please check the email or sign up for a new account.";
        break;
      case "auth/invalid-email":
        message = "Please enter a valid email address.";
        break;
      case "auth/too-many-requests":
        message = "Too many password reset requests. Please wait a few minutes before trying again.";
        break;
      case "auth/network-request-failed":
        message = "Network error. Please check your connection and try again.";
        break;
      default:
        message = `Failed to send password reset email: ${error.message}`;
    }
    
    alert(message);
  }
});

// Resend Verification Email Handler
document.getElementById('resendEmailBtn').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  
  if (!email || !password) {
    alert("Please enter your email and password first.");
    return;
  }
  
  try {
    // Temporarily sign in to resend email
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    if (user.emailVerified) {
      alert("Your email is already verified! You can log in normally.");
      await auth.signOut();
      return;
    }
    
    // Send verification email
    await sendEmailVerification(user);
    
    alert(`✅ Verification email sent to ${email}!

Please check your inbox and spam folder.`);
    
    // Sign out after sending
    await auth.signOut();
    
  } catch (error) {
    console.error("Resend error:", error);
    
    let message = "Failed to resend verification email.";
    
    if (error.code === 'auth/too-many-requests') {
      message = "Too many requests. Please wait a few minutes.";
    } else if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
      message = "Invalid email or password.";
    } else {
      message = `Error: ${error.message}`;
    }
    
    alert(message);
  }
});
