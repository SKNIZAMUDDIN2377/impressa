import { BrowserRouter, Routes, Route } from "react-router-dom";

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

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* =========================
            AUTH PAGES
            NO NAVBAR
        ========================= */}

        <Route
          path="/signin"
          element={<SignIn />}
        />

        <Route
          path="/create-account"
          element={<CreateAccount />}
        />


        {/* =========================
            MAIN APP
            NAVBAR INCLUDED
        ========================= */}

        <Route
          path="*"
          element={
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

                {/* USER'S POSTS FEED */}
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

                <Route path="/edit-profile" element={<EditProfile />} />

              </Routes>

            </MainLayout>
          }
        />

        <Route
          path="/account-center"
          element={<AccountCenter />}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;