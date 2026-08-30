import {
    getAuth,
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import { app } from "../firebase-config.js";

console.log("login.js loaded");

const auth = getAuth(app);

const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const loginSubmit = document.getElementById("login-submit");

console.log("login form:", loginForm);
console.log("login button:", loginSubmit);

loginForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    console.log("LOGIN FORM SUBMITTED");

    loginError.classList.add("hidden");

    loginSubmit.disabled = true;
    loginSubmit.textContent = "Signing in...";

    const email =
        document.getElementById("email").value.trim();

    const password =
        document.getElementById("password").value;

    console.log("Email:", email);
    console.log("Attempting Firebase login...");

    try {

        const userCredential =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

        console.log("LOGIN SUCCESSFUL");
        console.log("User:", userCredential.user.email);

        window.location.href = "dashboard.html";

    } catch (error) {

        console.error("FIREBASE LOGIN ERROR");
        console.error(error);
        console.error("Error code:", error.code);

        let message = "Could not sign in.";

        switch (error.code) {

            case "auth/invalid-credential":
                message = "Invalid email or password.";
                break;

            case "auth/user-not-found":
                message = "User not found.";
                break;

            case "auth/wrong-password":
                message = "Incorrect password.";
                break;

            case "auth/too-many-requests":
                message =
                    "Too many attempts. Please try again later.";
                break;

            case "auth/network-request-failed":
                message =
                    "Network error. Check your internet connection.";
                break;

            default:
                message = error.message;
        }

        loginError.textContent = message;
        loginError.classList.remove("hidden");

    } finally {

        loginSubmit.disabled = false;
        loginSubmit.textContent = "Sign in";

    }
});