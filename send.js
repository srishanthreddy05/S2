import { auth, db } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { ethers } from 'https://cdn.jsdelivr.net/npm/ethers@6.8.1/dist/ethers.min.js';

// ✅ Your Token Info
const tokenAddress = "0x56eaaf87a9f4b2cc413df472b23950b2a8db2fcc";
const tokenABI = [
  "function transfer(address to, uint amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)"
];

const provider = new ethers.JsonRpcProvider("https://eth-sepolia.g.alchemy.com/v2/ClpCcgdo1MhTbt2zqT84E");

onAuthStateChanged(auth, async (user) => {
  if (!user) return (window.location.href = "login.html");

  const userDoc = await getDoc(doc(db, "users", user.uid));
  const userData = userDoc.data();

  const privateKey = userData.privateKey;
  const senderWallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(tokenAddress, tokenABI, senderWallet);

  document.getElementById("sendForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = document.getElementById("statusMessage");

    const toAddress = document.getElementById("toAddress").value.trim();
    const amount = document.getElementById("amount").value.trim();

    // ✅ Validate input
    if (!ethers.isAddress(toAddress)) {
      status.innerText = "❌ Invalid recipient address.";
      return;
    }

    if (toAddress.toLowerCase() === senderWallet.address.toLowerCase()) {
      status.innerText = "⚠️ You can't send tokens to your own wallet.";
      return;
    }

    try {
      status.innerText = "⏳ Sending... please wait";

      const decimals = await contract.decimals();
      const amountInWei = ethers.parseUnits(amount, decimals);

      // ✅ Check balance
      const balance = await contract.balanceOf(senderWallet.address);
      if (amountInWei > balance) {
        const formatted = ethers.formatUnits(balance, decimals);
        status.innerText = `❌ Not enough S2 tokens. You only have ${formatted} S2.`;
        return;
      }

      // ✅ Send tokens
      const tx = await contract.transfer(toAddress, amountInWei);
      status.innerText = `⏳ Transaction sent. Hash: ${tx.hash}`;
      await tx.wait();

      status.innerText = `✅ Sent ${amount} S2 tokens to ${toAddress}`;
    } catch (err) {
      console.error("Send error:", err);
      status.innerText = `❌ Failed: ${err.message}`;
    }
  });
});
