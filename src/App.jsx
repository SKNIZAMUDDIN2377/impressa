import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import MainLayout from "./layouts/MainLayout";

import Home from "./pages/Home";
import Search from "./pages/Search";
import CreatePost from "./pages/CreatePost";
import Profile from "./pages/Profile";
import ProfilePosts from "./pages/ProfilePosts";
import Impressions from "./pages/Impressions";
import Pulse from "./pages/Pulse";

import SignIn from "./pages/SignIn";
import CreateAccount from "./pages/CreateAccount";

import AccountSettings from "./pages/AccountSettings";
import Privacy from "./pages/Privacy";
import Notifications from "./pages/Notifications";
import Help from "./pages/Help";
import AccountCenter from "./pages/AccountCenter";
import EditProfile from "./pages/EditProfile";
import SharedPost from "./pages/SharedPost";


// ==========================================
// AUTH PROTECTION
// ==========================================

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/signin" replace />;
  }

  return children;
}


// ==========================================
// APP
// ==========================================

function App() {
  return (
    <BrowserRouter>

      <Routes>

        {/* ==========================================
            AUTH PAGES
            NO NAVBAR
        ========================================== */}

        <Route
          path="/signin"
          element={<SignIn />}
        />

        <Route
          path="/create-account"
          element={<CreateAccount />}
        />


        {/* ==========================================
            PROTECTED APP
        ========================================== */}

        <Route
          path="*"
          element={
            <ProtectedRoute>

              <MainLayout>

                <Routes>

                  {/* HOME */}

                  <Route
                    path="/"
                    element={<Home />}
                  />


                  {/* SHARED POST */}

                  <Route
                    path="/post/:postId"
                    element={<SharedPost />}
                  />


                  {/* SEARCH */}

                  <Route
                    path="/search"
                    element={<Search />}
                  />


                  {/* CREATE POST */}

                  <Route
                    path="/create-post"
                    element={<CreatePost />}
                  />


                  {/* YOUR PROFILE */}

                  <Route
                    path="/profile"
                    element={<Profile />}
                  />


                  {/* OTHER USER PROFILE */}

                  <Route
                    path="/profile/:username"
                    element={<Profile />}
                  />


                  {/* USER POSTS */}

                  <Route
                    path="/profile/:username/posts"
                    element={<ProfilePosts />}
                  />


                  {/* IMPRESSIONS */}

                  <Route
                    path="/impressions"
                    element={<Impressions />}
                  />


                  {/* PULSE */}

                  <Route
                    path="/pulse"
                    element={<Pulse />}
                  />


                  {/* ACCOUNT SETTINGS */}

                  <Route
                    path="/account-settings"
                    element={<AccountSettings />}
                  />


                  {/* PRIVACY */}

                  <Route
                    path="/privacy"
                    element={<Privacy />}
                  />


                  {/* NOTIFICATIONS */}

                  <Route
                    path="/notifications"
                    element={<Notifications />}
                  />


                  {/* HELP */}

                  <Route
                    path="/help"
                    element={<Help />}
                  />


                  {/* EDIT PROFILE */}

                  <Route
                    path="/edit-profile"
                    element={<EditProfile />}
                  />

                </Routes>

              </MainLayout>

            </ProtectedRoute>
          }
        />


        {/* ACCOUNT CENTER */}

        <Route
          path="/account-center"
          element={
            <ProtectedRoute>
              <AccountCenter />
            </ProtectedRoute>
          }
        />

      </Routes>

    </BrowserRouter>
  );
}

export default App;