const baseUrl = "https://synthex-rgnbbbwb1-unite-group.vercel.app";
console.log("Testing SYNTHEX Production: " + baseUrl);
fetch(baseUrl + "/api/auth/signup", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "test" + Date.now() + "@example.com",
    password: "TestPass123\!",
    name: "Test User"
  })
}).then(r => r.json()).then(console.log).catch(console.error);
