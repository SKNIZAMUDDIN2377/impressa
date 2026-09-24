import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AccountCenter.css";

function AccountCenter() {
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState([]);
  const [activeAccount, setActiveAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  const API_URL = `http://${window.location.hostname}:5000`;

  // ==========================================
  // LOAD CURRENT ACCOUNT
  // ==========================================

  useEffect(() => {
    const loadAccount = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          navigate("/signin");
          return;
        }

        const response = await fetch(
          `${API_URL}/api/auth/settings`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to load account"
          );
        }

        if (!data.user) {
          throw new Error(
            "Account information not found"
          );
        }

        const user = data.user;

        // ==========================================
        // LOAD LOCALLY STORED ACCOUNTS
        // ==========================================

        const storedAccounts = JSON.parse(
          localStorage.getItem(
            "impressa_accounts"
          ) || "[]"
        );

        // Find saved version of current account
        // so its JWT token is preserved.
        const savedCurrentAccount =
          storedAccounts.find(
            (account) =>
              String(account.id) ===
              String(user.id)
          );

        const currentAccount = {
          id: user.id,
          name: user.name,
          username: user.username,
          phone: user.phone,
          profilePic:
            user.profilePicture || "",
          token:
            savedCurrentAccount?.token ||
            token,
        };

        // ==========================================
        // REMOVE DUPLICATE CURRENT ACCOUNT
        // ==========================================

        const otherAccounts =
          storedAccounts.filter(
            (account) =>
              String(account.id) !==
              String(currentAccount.id)
          );

        const finalAccounts = [
          currentAccount,
          ...otherAccounts,
        ];

        setAccounts(finalAccounts);
        setActiveAccount(currentAccount);

        // Save updated account list
        localStorage.setItem(
          "impressa_accounts",
          JSON.stringify(finalAccounts)
        );

        localStorage.setItem(
          "impressa_active_account",
          JSON.stringify(currentAccount)
        );
      } catch (error) {
        console.error(
          "Account Center loading error ❌",
          error
        );

        if (
          error.message.includes(
            "Authentication"
          ) ||
          error.message.includes("expired")
        ) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");

          navigate("/signin");
        }
      } finally {
        setLoading(false);
      }
    };

    loadAccount();
  }, [navigate]);

  // ==========================================
  // SWITCH ACCOUNT
  // ==========================================

  const switchAccount = (account) => {
    localStorage.setItem(
      "impressa_active_account",
      JSON.stringify(account)
    );

    setActiveAccount(account);

    /*
      IMPORTANT:

      Account switching between multiple real
      backend accounts requires logging into the
      selected account and receiving its JWT.

      Therefore, if the selected account is not
      the currently authenticated account, send
      the user to Sign In.
    */

    const currentUser = JSON.parse(
      localStorage.getItem("user") || "null"
    );

    if (
      currentUser &&
      String(currentUser.id) ===
        String(account.id)
    ) {
      navigate("/profile");
      return;
    }

    navigate("/signin");
  };

  // ==========================================
  // OPEN / SWITCH ACCOUNT
  // ==========================================

  const openAccount = (account) => {
    // Account has no saved authentication token
    if (!account.token) {
      alert(
        "Please sign in to this account once before switching to it."
      );

      navigate("/signin");
      return;
    }

    // ==========================================
    // SWITCH JWT
    // ==========================================

    localStorage.setItem(
      "token",
      account.token
    );

    // ==========================================
    // SWITCH LOGGED-IN USER
    // ==========================================

    const loggedInUser = {
      id: account.id,
      name: account.name,
      username: account.username,
    };

    localStorage.setItem(
      "user",
      JSON.stringify(loggedInUser)
    );

    // ==========================================
    // SET ACTIVE ACCOUNT
    // ==========================================

    localStorage.setItem(
      "impressa_active_account",
      JSON.stringify(account)
    );

    setActiveAccount(account);

    // ==========================================
    // OPEN SWITCHED ACCOUNT PROFILE
    // ==========================================

    navigate("/profile");
  };

  // ==========================================
  // ADD ACCOUNT
  // ==========================================

  const addAccount = () => {
    /*
      Sign in page will allow another Impressa
      account to be authenticated.
    */

    navigate("/signin");
  };

  // ==========================================
  // DELETE LOCAL ACCOUNT ENTRY
  // ==========================================

  const deleteAccount = (accountId) => {
    if (accounts.length === 1) {
      alert(
        "You must keep at least one Impressa account."
      );

      return;
    }

    const confirmed = window.confirm(
      "Remove this account from Account Center?"
    );

    if (!confirmed) {
      return;
    }

    const updatedAccounts =
      accounts.filter(
        (account) =>
          String(account.id) !==
          String(accountId)
      );

    setAccounts(updatedAccounts);

    localStorage.setItem(
      "impressa_accounts",
      JSON.stringify(updatedAccounts)
    );

    // ==========================================
    // IF ACTIVE ACCOUNT WAS REMOVED
    // ==========================================

    if (
      activeAccount &&
      String(activeAccount.id) ===
        String(accountId)
    ) {
      const nextAccount =
        updatedAccounts[0];

      setActiveAccount(nextAccount);

      localStorage.setItem(
        "impressa_active_account",
        JSON.stringify(nextAccount)
      );
    }
  };

  // ==========================================
  // LOADING
  // ==========================================

  if (loading) {
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

            <h2>
              Loading your accounts...
            </h2>

            <p>
              Please wait while Impressa loads
              your account information.
            </p>

          </div>

        </main>

      </div>
    );
  }

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

          <h2>
            Your Impressa Accounts
          </h2>

          <p>
            Switch between the accounts connected
            to your Impressa session.
          </p>

        </div>


        <div className="account-list">

          {accounts.map((account) => {

            const isActive =
              activeAccount?.id === account.id;

            return (
              <div
                className={`account-item ${
                  isActive
                    ? "active-account"
                    : ""
                }`}
                key={account.id}
              >

                <button
                  type="button"
                  className="account-item-main"
                  onClick={() =>
                    switchAccount(account)
                  }
                >

                  {account.profilePic ? (
                    <img
                      src={account.profilePic}
                      alt={`${account.name}'s profile`}
                    />
                  ) : (
                    <div className="account-placeholder">
                      {account.name
                        ?.charAt(0)
                        ?.toUpperCase() || "I"}
                    </div>
                  )}


                  <div className="account-item-info">

                    <strong>
                      {account.name}
                    </strong>

                    <span>
                      @{account.username}
                    </span>

                    {isActive && (
                      <small>
                        Current account
                      </small>
                    )}

                  </div>

                </button>


                {/* ==========================================
                    OPEN / SWITCH ACCOUNT
                ========================================== */}

                <button
                  type="button"
                  className="open-account-button"
                  onClick={() =>
                    openAccount(account)
                  }
                  aria-label={`Open ${account.username}`}
                >
                  Open
                </button>


                {/* ==========================================
                    REMOVE ACCOUNT
                ========================================== */}

                <button
                  type="button"
                  className="delete-account-button"
                  onClick={() =>
                    deleteAccount(account.id)
                  }
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