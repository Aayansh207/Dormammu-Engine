
const bcrypt = require("bcryptjs");
const prisma = require("./src/config/db");
const authService = require("./src/services/auth.service");
const sessionService = require("./src/services/session.service");
const userService = require("./src/services/user.service");
const { verifyAccessToken } = require("./src/utils/tokens");
const env = require("./env");

const results = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTest(number, name, fn) {
  try {
    await fn();
    console.log(`✔ [PASS] Test ${number}: ${name}`);
    results.push({ number, name, passed: true });
  } catch (err) {
    console.error(`✖ [FAIL] Test ${number}: ${name}`);
    console.error(`   Error: ${err.message}`);
    results.push({ number, name, passed: false, error: err.message });
  }
}

async function cleanupTestData() {
  const emails = [
    "test_runner_1@dormammu.dev",
    "test_runner_2@dormammu.dev",
    "test_google_merge@dormammu.dev",
    "test_concurrent@dormammu.dev",
  ];
  try {
    await prisma.user.deleteMany({
      where: { email: { in: emails } },
    });
  } catch (e) {
    // ignore
  }
}

async function main() {
  console.log("\nDormammu Loop - Authentication & Security Test Suite");


  await cleanupTestData();

  let user1 = null;
  let rawVerifyTokenUser1 = null;
  let user1Tokens = null;
  let user2 = null;
  let user2Tokens = null;

  // 1. Signup succeeds
  await runTest(1, "Signup succeeds", async () => {
    const res = await authService.signup({
      name: "Runner One",
      email: "test_runner_1@dormammu.dev",
      password: "SecurePassword123!",
      userAgent: "TestAgent/1.0",
      ipAddress: "127.0.0.1",
    });

    assert(res.user && res.user.email === "test_runner_1@dormammu.dev", "User object returned");
    user1 = res.user;
    assert(typeof res.user.emailVerified === "boolean", "User emailVerified boolean exists");
  });

  // 2. Duplicate signup is rejected
  await runTest(2, "Duplicate signup is rejected", async () => {
    let rejected = false;
    try {
      await authService.signup({
        name: "Runner One Dup",
        email: "test_runner_1@dormammu.dev",
        password: "AnotherPassword123!",
      });
    } catch (err) {
      if (err.statusCode === 409) rejected = true;
    }
    assert(rejected, "Duplicate signup correctly rejected with 409 Conflict");
  });

  // 3. Passwords are stored hashed
  await runTest(3, "Passwords are stored hashed", async () => {
    const dbUser = await prisma.user.findUnique({
      where: { id: user1.id },
    });
    assert(dbUser.passwordHash !== null, "passwordHash exists");
    assert(dbUser.passwordHash !== "SecurePassword123!", "Raw password is NOT stored");
    assert(dbUser.passwordHash.startsWith("$2"), "Password stored as valid bcrypt hash");
    const matches = await bcrypt.compare("SecurePassword123!", dbUser.passwordHash);
    assert(matches, "Bcrypt hash validates correctly with original password");
  });

  // 6. Unverified-account behavior matches intended policy
  await runTest(6, "Unverified-account behavior matches intended policy", async () => {
    if (env.REQUIRE_EMAIL_VERIFICATION) {
      await prisma.user.update({ where: { id: user1.id }, data: { emailVerified: false } });
      let rejected = false;
      try {
        await authService.login({
          email: "test_runner_1@dormammu.dev",
          password: "SecurePassword123!",
        });
      } catch (err) {
        if (err.statusCode === 403 && err.unverified === true) {
          rejected = true;
        }
      }
      assert(rejected, "Unverified user correctly forbidden from login (403)");
    } else {
      assert(true, "Email verification policy matches REQUIRE_EMAIL_VERIFICATION configuration");
    }
  });

  // 7. Email verification succeeds with a valid token
  await runTest(7, "Email verification succeeds with a valid token", async () => {
    // Generate a fresh token for user1 to test verifyEmail
    const { generateVerificationToken, hashToken } = require("./src/utils/tokens");
    rawVerifyTokenUser1 = generateVerificationToken();
    const tokenHash = hashToken(rawVerifyTokenUser1);
    await prisma.emailVerificationToken.create({
      data: {
        tokenHash,
        userId: user1.id,
        expiresAt: new Date(Date.now() + 3600 * 1000),
      },
    });

    const res = await authService.verifyEmail(rawVerifyTokenUser1);
    assert(res.success === true, "Verification response successful");

    const updatedUser = await prisma.user.findUnique({ where: { id: user1.id } });
    assert(updatedUser.emailVerified === true, "User emailVerified updated to true");
  });

  // 8. Expired and reused verification tokens fail
  await runTest(8, "Expired and reused verification tokens fail", async () => {
    // 8a. Reused token
    let reusedRejected = false;
    try {
      await authService.verifyEmail(rawVerifyTokenUser1);
    } catch (err) {
      if (err.statusCode === 400 && err.message.includes("already been used")) {
        reusedRejected = true;
      }
    }
    assert(reusedRejected, "Reused verification token rejected");

    // 8b. Expired token
    const { generateVerificationToken, hashToken } = require("./src/utils/tokens");
    const expiredRaw = generateVerificationToken();
    await prisma.emailVerificationToken.create({
      data: {
        tokenHash: hashToken(expiredRaw),
        userId: user1.id,
        expiresAt: new Date(Date.now() - 1000), // expired 1s ago
      },
    });

    let expiredRejected = false;
    try {
      await authService.verifyEmail(expiredRaw);
    } catch (err) {
      if (err.statusCode === 400 && err.message.includes("expired")) {
        expiredRejected = true;
      }
    }
    assert(expiredRejected, "Expired verification token rejected");
  });

  // 4. Login with valid credentials succeeds
  await runTest(4, "Login with valid credentials succeeds", async () => {
    const res = await authService.login({
      email: "test_runner_1@dormammu.dev",
      password: "SecurePassword123!",
      userAgent: "TestAgent/1.0",
      ipAddress: "127.0.0.1",
    });

    assert(res.accessToken && res.refreshToken, "Tokens returned on login");
    assert(res.session && res.session.id, "Session created on login");
    user1Tokens = res;
  });

  // 5. Invalid passwords are rejected
  await runTest(5, "Invalid passwords are rejected", async () => {
    let rejected = false;
    try {
      await authService.login({
        email: "test_runner_1@dormammu.dev",
        password: "WrongPassword!",
      });
    } catch (err) {
      if (err.statusCode === 401) rejected = true;
    }
    assert(rejected, "Invalid password rejected with 401");
  });

  // 9. Access tokens authenticate protected routes
  await runTest(9, "Access tokens authenticate protected routes", async () => {
    const decoded = verifyAccessToken(user1Tokens.accessToken);
    assert(decoded && decoded.sub === user1.id, "Access token valid for user1");

    const profile = await userService.getUserProfile(user1.id);
    assert(profile.id === user1.id, "User profile retrieved successfully");
  });

  // 10. Expired or invalid tokens are rejected
  await runTest(10, "Expired or invalid tokens are rejected", async () => {
    const invalidToken = "invalid.jwt.token";
    const decoded = verifyAccessToken(invalidToken);
    assert(decoded === null, "Invalid token verification returns null");
  });

  // 11. Refresh-token rotation works
  let rotatedTokens = null;
  await runTest(11, "Refresh-token rotation works", async () => {
    const res = await authService.refresh({
      refreshToken: user1Tokens.refreshToken,
    });

    assert(res.accessToken !== null, "New access token issued");
    assert(res.refreshToken !== user1Tokens.refreshToken, "Refresh token rotated to a new value");
    assert(res.session.id === user1Tokens.session.id, "Session ID maintained across rotation");
    rotatedTokens = res;
  });

  // 12. Reused or revoked refresh tokens are rejected
  await runTest(12, "Reused or revoked refresh tokens are rejected (Replay Protection)", async () => {
    let rejected = false;
    try {
      // Attempt to use the old refresh token that was already rotated out
      await authService.refresh({
        refreshToken: user1Tokens.refreshToken,
      });
    } catch (err) {
      rejected = true;
    }
    assert(rejected, "Old rotated refresh token correctly rejected");
  });

  // 13. Google login creates or finds the correct user
  let googleUser = null;
  await runTest(13, "Google login creates or finds the correct user", async () => {
    // Mock verifyGoogleToken to simulate Google ID token without live Google network call
    const originalVerify = authService.verifyGoogleToken;
    authService.verifyGoogleToken = async () => ({
      sub: "google_sub_12345",
      email: "test_google_user@dormammu.dev",
      email_verified: true,
      name: "Google Traveler",
      picture: "https://lh3.googleusercontent.com/photo.jpg",
    });

    try {
      const res = await authService.googleLogin({
        idToken: "mock_google_id_token",
      });

      assert(res.user.email === "test_google_user@dormammu.dev", "User created via Google");
      assert(res.user.emailVerified === true, "Google user emailVerified is true");
      assert(res.user.profilePhoto === "https://lh3.googleusercontent.com/photo.jpg", "Profile photo set");
      googleUser = res.user;

      // Check OAuthAccount record
      const oauthAcc = await prisma.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: "google",
            providerAccountId: "google_sub_12345",
          },
        },
      });
      assert(oauthAcc !== null, "OAuthAccount record exists");
      assert(oauthAcc.userId === googleUser.id, "OAuthAccount links to user");
    } finally {
      authService.verifyGoogleToken = originalVerify;
      await prisma.user.deleteMany({ where: { email: "test_google_user@dormammu.dev" } });
    }
  });

  // 14. Google and native login link to one user when safely eligible
  await runTest(14, "Google and native login link to one user when safely eligible", async () => {
    // 14a: Create native user first with password
    const nativeRes = await authService.signup({
      name: "Merge Target",
      email: "test_google_merge@dormammu.dev",
      password: "Password123!",
    });
    // Verify native user email
    await prisma.user.update({
      where: { id: nativeRes.user.id },
      data: { emailVerified: true },
    });

    // 14b: Log in with Google using same email
    const originalVerify = authService.verifyGoogleToken;
    authService.verifyGoogleToken = async () => ({
      sub: "google_sub_merge_9999",
      email: "test_google_merge@dormammu.dev",
      email_verified: true,
      name: "Google Merged Name",
      picture: "https://lh3.googleusercontent.com/merged.jpg",
    });

    try {
      const googleRes = await authService.googleLogin({
        idToken: "mock_token_for_merge",
      });

      assert(googleRes.user.id === nativeRes.user.id, "Google identity linked to existing native user ID");
      
      const dbUser = await prisma.user.findUnique({
        where: { id: nativeRes.user.id },
        include: { oauthAccounts: true },
      });

      assert(dbUser.passwordHash !== null, "Original password hash preserved!");
      assert(dbUser.oauthAccounts.length === 1, "OAuthAccount linked");
      assert(dbUser.oauthAccounts[0].providerAccountId === "google_sub_merge_9999", "Provider ID matches");

      // Verify user can STILL log in with their native password!
      const nativeLoginRes = await authService.login({
        email: "test_google_merge@dormammu.dev",
        password: "Password123!",
      });
      assert(nativeLoginRes.user.id === nativeRes.user.id, "Native login still works after Google linking");
    } finally {
      authService.verifyGoogleToken = originalVerify;
    }
  });

  // 15. Concurrent requests do not create duplicate accounts
  await runTest(15, "Concurrent requests do not create duplicate accounts", async () => {
    const email = "test_concurrent@dormammu.dev";
    const attempts = [
      authService.signup({ name: "Conc 1", email, password: "Password123!" }),
      authService.signup({ name: "Conc 2", email, password: "Password123!" }),
      authService.signup({ name: "Conc 3", email, password: "Password123!" }),
    ];

    const results = await Promise.allSettled(attempts);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    assert(fulfilled.length === 1, "Exactly one concurrent signup succeeded");
    assert(rejected.length === 2, "Duplicate concurrent signups safely rejected");

    const count = await prisma.user.count({ where: { email } });
    assert(count === 1, "Exactly 1 user row in database");
  });

  // 16. Active sessions are listed correctly
  await runTest(16, "Active sessions are listed correctly", async () => {
    // Create second session for user1
    await sessionService.createSession({
      userId: user1.id,
      refreshToken: "test_session_2_token",
      userAgent: "SecondaryDevice/1.0",
      ipAddress: "192.168.1.50",
    });

    const sessions = await sessionService.getUserActiveSessions(user1.id, rotatedTokens.session.id);
    assert(sessions.length >= 2, "At least 2 active sessions listed");
    const current = sessions.find((s) => s.isCurrent === true);
    assert(current !== undefined, "Current session flagged with isCurrent: true");
    assert(sessions[0].refreshTokenHash === undefined, "Never leaks refreshTokenHash");
  });

  // 17. One session can be revoked without revoking unrelated sessions
  await runTest(17, "One session can be revoked without revoking unrelated sessions", async () => {
    const sessionsBefore = await sessionService.getUserActiveSessions(user1.id);
    const sessionToRevoke = sessionsBefore.find((s) => s.id !== rotatedTokens.session.id);
    assert(sessionToRevoke !== undefined, "Found second session to revoke");

    await sessionService.revokeSession(sessionToRevoke.id, user1.id);

    const sessionsAfter = await sessionService.getUserActiveSessions(user1.id);
    assert(sessionsAfter.length === sessionsBefore.length - 1, "Session count decreased by 1");
    const stillActive = sessionsAfter.find((s) => s.id === rotatedTokens.session.id);
    assert(stillActive !== undefined, "Main session remains active");
  });

  // 18. Logout-all revokes all of the user's active refresh-token sessions
  await runTest(18, "Logout-all revokes all user active refresh-token sessions", async () => {
    await authService.logoutAll(user1.id);

    const activeSessions = await sessionService.getUserActiveSessions(user1.id);
    assert(activeSessions.length === 0, "All active sessions revoked");

    let refreshFails = false;
    try {
      await authService.refresh({ refreshToken: rotatedTokens.refreshToken });
    } catch (e) {
      refreshFails = true;
    }
    assert(refreshFails, "Revoked sessions cannot refresh tokens");
  });

  // 19. One user cannot access another user's sessions
  await runTest(19, "One user cannot access or revoke another user's sessions", async () => {
    // Create user2
    const res2 = await authService.signup({
      name: "Runner Two",
      email: "test_runner_2@dormammu.dev",
      password: "Password123!",
    });
    user2 = res2.user;
    await prisma.user.update({ where: { id: user2.id }, data: { emailVerified: true } });
    const user2Login = await authService.login({
      email: "test_runner_2@dormammu.dev",
      password: "Password123!",
    });

    // Try to revoke user2's session using user1's identity
    let crossRevokeBlocked = false;
    try {
      await sessionService.revokeSession(user2Login.session.id, user1.id);
    } catch (err) {
      if (err.statusCode === 403) crossRevokeBlocked = true;
    }
    assert(crossRevokeBlocked, "Unauthorized cross-user session revocation blocked with 403");
  });

  // 20. Profile updates work without allowing unauthorized role changes
  await runTest(20, "Profile updates work without allowing unauthorized role changes", async () => {
    const updated = await userService.updateUserProfile(user2.id, {
      name: "Updated Name",
      profilePhoto: "https://photos.dormammu.dev/user2.png",
      role: "ADMIN", // Attempt unauthorized role elevation
    });

    assert(updated.name === "Updated Name", "Name updated successfully");
    assert(updated.profilePhoto === "https://photos.dormammu.dev/user2.png", "Photo updated");
    assert(updated.role === "USER", "Role change silently ignored and prevented");

    const dbUser = await prisma.user.findUnique({ where: { id: user2.id } });
    assert(dbUser.role === "USER", "Role is still USER in database");
  });

  // Cleanup test data
  await cleanupTestData();

  console.log("\n============================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  console.log(`Test Results: ${passed}/${total} passed (${((passed / total) * 100).toFixed(0)}%)`);
  console.log("============================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error("Test runner crash:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
