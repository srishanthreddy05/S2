const tokenAddress = "0x56EaaF87a9f4B2cC413DF472B23950b2a8Db2FCC"; // replace with your S2 token address
const tokenABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint amount) returns (bool)"
];

let signer;
let contract;

async function connectWallet() {
  if (typeof window.ethereum === "undefined") {
    alert("MetaMask is not installed!");
    return;
  }

  const provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = provider.getSigner();

  const address = await signer.getAddress();
  document.getElementById("walletAddress").textContent = `Wallet: ${address}`;

  contract = new ethers.Contract(tokenAddress, tokenABI, signer);
  const balance = await contract.balanceOf(address);
  const formatted = ethers.utils.formatUnits(balance, 18);
  document.getElementById("tokenBalance").textContent = `S2 Balance: ${formatted}`;
    // After showing balance
  checkRewardStatus();

}


async function sendTokens() {
  const recipient = document.getElementById("recipient").value;
  const amount = document.getElementById("amount").value;
  const parsed = ethers.utils.parseUnits(amount, 18);

  try {
    const tx = await contract.transfer(recipient, parsed);
    document.getElementById("status").textContent = "Sending...";
    await tx.wait();
    document.getElementById("status").textContent = "✅ Sent successfully!";
    connectWallet(); // Refresh balance
  } catch (error) {
    console.error(error);
    document.getElementById("status").textContent = "❌ Error sending tokens.";
  }
}
function checkRewardStatus() {
  const today = new Date().toLocaleDateString();
  const lastClaimed = localStorage.getItem("dailyReward");

  if (lastClaimed === today) {
    document.getElementById("claimBtn").disabled = true;
    document.getElementById("rewardStatus").textContent = "✅ Already claimed today!";
  } else {
    document.getElementById("claimBtn").disabled = false;
    document.getElementById("rewardStatus").textContent = "🎁 Ready to claim!";
  }
}

async function claimReward() {
  const address = await signer.getAddress();
  const rewardAmount = ethers.utils.parseUnits("5", 18); // 5 S2 daily reward

  try {
    const tx = await contract.transfer(address, rewardAmount);
    document.getElementById("rewardStatus").textContent = "⏳ Claiming...";
    await tx.wait();
    localStorage.setItem("dailyReward", new Date().toLocaleDateString());
    document.getElementById("rewardStatus").textContent = "✅ Reward claimed!";
    document.getElementById("claimBtn").disabled = true;
    connectWallet(); // Refresh balance
  } catch (err) {
    console.error(err);
    document.getElementById("rewardStatus").textContent = "❌ Failed to claim reward.";
  }
}

