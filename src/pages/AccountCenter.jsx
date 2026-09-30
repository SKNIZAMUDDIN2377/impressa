import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AccountCenter.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const getSavedAccounts = () => {
  try {
    const storedAccounts = JSON.parse(
      localStorage.getItem("impressa_accounts") || "[]"
    );

    const savedActiveAccount = JSON.parse(
      localStorage.getItem("impressa_active_account") || "null"
    );

    return {
      accounts: Array.isArray(storedAccounts) ? storedAccounts : [],
      activeAccount: savedActiveAccount,
    };
  } catch (error) {
    console.error("Saved account loading error ❌", error);

    return {
      accounts: [],
      activeAccount: null,
    };
  }
};

const getLoggedInUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch (error) {
    return null;
  }
};

function AccountCenter() {
  const navigate = useNavigate();

  const [savedData] = useState(getSavedAccounts);

  const [accounts, setAccounts] = useState(savedData.accounts);
  const [activeAccount, setActiveAccount] = useState(
    savedData.activeAccount
  );

  // ==========================================
  // LOAD CURRENT ACCOUNT FROM BACKEND
  // (never blocks the page — saved accounts show instantly)
  // ==========================================

  useEffect(() => {
    let mounted = true;

    const loadAccount = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          navigate("/signin");
          return;
        }

        const response = await fetch(`${API_URL}/api/auth/settings`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!mounted) return;

        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/signin");
          return;
        }

        if (!response.ok) {
          throw new Error(data.message || "Unable to load account");
        }

        if (!data.user) {
          throw new Error("Account information not found");
        }

        const user = data.user;

        let storedAccounts = [];

        try {
          storedAccounts = JSON.parse(
            localStorage.getItem("impressa_accounts") || "[]"
          );
        } catch (error) {
          console.error("Stored accounts parse error ❌", error);
        }

        // The current account ALWAYS uses the fresh token that is
        // actually logged in right now, never an older saved one.
        const currentAccount = {
          id: user.id,
          name: user.name,
          username: user.username,
          phone: user.phone,
          profilePic: user.profilePicture || "",
          token,
        };

        const otherAccounts = storedAccounts.filter(
          (account) => String(account.id) !== String(currentAccount.id)
        );

        const finalAccounts = [currentAccount, ...otherAccounts];

        setAccounts(finalAccounts);
        setActiveAccount(currentAccount);

        localStorage.setItem(
          "impressa_accounts",
          JSON.stringify(finalAccounts)
        );

        localStorage.setItem(
          "impressa_active_account",
          JSON.stringify(currentAccount)
        );
      } catch (error) {
        console.error("Account Center background loading error ❌", error);
        // Keep showing the saved accounts already on screen.
      }
    };

    loadAccount();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  // ==========================================
  // OPEN / SWITCH ACCOUNT
  // ==========================================

  const openAccount = (account) => {
    const currentUser = getLoggedInUser();

    // Already the logged-in account → just open its profile.
    if (currentUser && String(currentUser.id) === String(account.id)) {
      navigate("/profile");
      return;
    }

    if (!account.token) {
      alert("Please sign in to this account once before switching to it.");
      navigate("/signin");
      return;
    }

    localStorage.setItem("token", account.token);

    localStorage.setItem(
      "user",
      JSON.stringify({
        id: account.id,
        name: account.name,
        username: account.username,
        profilePicture: account.profilePic || "",
      })
    );

    localStorage.setItem(
      "impressa_active_account",
      JSON.stringify(account)
    );

    setActiveAccount(account);

    // Full reload so no in-memory data from the previous account
    // (feeds, caches, navbar state) can leak into this one.
    window.location.assign("/profile");
  };

  // ==========================================
  // ADD ACCOUNT
  // ==========================================

  const addAccount = () => {
    navigate("/signin");
  };

  // ==========================================
  // REMOVE ACCOUNT FROM ACCOUNT CENTER
  // ==========================================

  const removeAccount = (accountId) => {
    const currentUser = getLoggedInUser();

    if (currentUser && String(currentUser.id) === String(accountId)) {
      alert(
        "You are currently logged in to this account. Switch to another account or log out first."
      );
      return;
    }

    if (accounts.length === 1) {
      alert("You must keep at least one Impressa account.");
      return;
    }

    const confirmed = window.confirm(
      "Remove this account from Account Center?"
    );

    if (!confirmed) return;

    const updatedAccounts = accounts.filter(
      (account) => String(account.id) !== String(accountId)
    );

    setAccounts(updatedAccounts);

    localStorage.setItem(
      "impressa_accounts",
      JSON.stringify(updatedAccounts)
    );
  };

  // ==========================================
  // UI
  // ==========================================

  return (
    <div className="account-center-page">
      <div className="account-center-topbar">
        <button
          type="button"
          className="account-center-back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          ←
        </button>

        <h1>Account Center</h1>

        <div className="account-center-topbar-space" />
      </div>

      <main className="account-center-content">
        <div className="account-center-heading">
          <h2>Your Impressa Accounts</h2>

          <p>
            Switch between the accounts connected to your Impressa session.
          </p>
        </div>

        <div className="account-list">
          {accounts.map((account) => {
            const isActive =
              String(activeAccount?.id) === String(account.id);

            return (
              <div
                className={`account-item ${
                  isActive ? "active-account" : ""
                }`}
                key={account.id}
              >
                <button
                  type="button"
                  className="account-item-main"
                  onClick={() => openAccount(account)}
                >
                  {account.profilePic ? (
                    <img
                      src={account.profilePic}
                      alt={`${account.name}'s profile`}
                    />
                  ) : (
                    <div className="account-placeholder">
                      {account.name?.charAt(0)?.toUpperCase() || "I"}
                    </div>
                  )}

                  <div className="account-item-info">
                    <strong>{account.name}</strong>

                    <span>@{account.username}</span>

                    {isActive && <small>Current account</small>}
                  </div>
                </button>

                <button
                  type="button"
                  className="open-account-button"
                  onClick={() => openAccount(account)}
                  aria-label={`Open ${account.username}`}
                >
                  Open
                </button>

                <button
                  type="button"
                  className="delete-account-button"
                  onClick={() => removeAccount(account.id)}
                  aria-label={`Remove ${account.username}`}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="add-account-button"
          onClick={addAccount}
        >
          + Add Account
        </button>
      </main>
    </div>
  );
}

export default AccountCenter;