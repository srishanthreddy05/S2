// gameUtils.js
import { auth, db } from './firebase.js';
import { doc, updateDoc, increment, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export class GameEarnings {
  static async addCoins(gameType, amount) {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User not authenticated");
    }

    try {
      const userRef = doc(db, "users", user.uid);
      
      // Use increment to avoid race conditions
      await updateDoc(userRef, {
        [`gamesEarnings.${gameType}`]: increment(amount)
      });

      return true;
    } catch (error) {
      console.error("Error adding coins:", error);
      throw error;
    }
  }

  static async getEarnings(gameType = null) {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User not authenticated");
    }

    try {
      const userRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(userRef);
      
      if (docSnap.exists()) {
        const earnings = docSnap.data().gamesEarnings || {};
        return gameType ? (earnings[gameType] || 0) : earnings;
      }
      
      return gameType ? 0 : {};
    } catch (error) {
      console.error("Error getting earnings:", error);
      throw error;
    }
  }

  static async getTotalEarnings() {
    try {
      const earnings = await this.getEarnings();
      return Object.values(earnings).reduce((sum, val) => sum + (val || 0), 0);
    } catch (error) {
      console.error("Error getting total earnings:", error);
      return 0;
    }
  }
}

// Cooldown management
export class GameCooldown {
  static setCooldown(gameType, minutes) {
    const expiry = Date.now() + (minutes * 60 * 1000);
    localStorage.setItem(`cooldown_${gameType}`, expiry.toString());
  }

  static getCooldownRemaining(gameType) {
    const expiry = localStorage.getItem(`cooldown_${gameType}`);
    if (!expiry) return 0;
    
    const remaining = parseInt(expiry) - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  static isOnCooldown(gameType) {
    return this.getCooldownRemaining(gameType) > 0;
  }

  static formatCooldownTime(milliseconds) {
    const minutes = Math.floor(milliseconds / (60 * 1000));
    const seconds = Math.floor((milliseconds % (60 * 1000)) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}
