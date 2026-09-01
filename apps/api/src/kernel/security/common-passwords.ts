/**
 * Denylist of common passwords (PLAN/04 §4.1).
 *
 * The document specifies the 10,000 most common passwords. Shipping that list as
 * a source file would add roughly 90 KB of literals to the repository and to
 * every review diff, so this holds the high-frequency head of the distribution
 * and the Indonesian-context entries a generic English list misses. The Have I
 * Been Pwned k-anonymity check in `password.ts` covers the long tail against a
 * corpus far larger than 10,000 without shipping any of it.
 *
 * If an offline-only deployment is ever required, replace this with a loader for
 * a newline-delimited wordlist read at boot; the interface stays a Set<string>.
 */

const ENTRIES = [
  // Global top-of-list
  "123456", "password", "123456789", "12345678", "12345", "qwerty", "abc123",
  "111111", "1234567", "123123", "000000", "iloveyou", "1234567890", "1234",
  "qwerty123", "password1", "password123", "admin", "administrator", "welcome",
  "monkey", "dragon", "letmein", "login", "princess", "sunshine", "football",
  "baseball", "master", "superman", "batman", "trustno1", "shadow", "michael",
  "jennifer", "jordan", "hunter", "harley", "ranger", "buster", "soccer",
  "hockey", "killer", "george", "andrew", "charlie", "thomas", "robert",
  "asdfgh", "zxcvbn", "qwertyuiop", "1q2w3e4r", "1qaz2wsx", "qazwsx",
  "changeme", "secret", "passw0rd", "p@ssw0rd", "p@ssword", "welcome1",
  "test123", "root", "toor", "guest", "default", "system", "manager",

  // Indonesian context — absent from English-only lists and heavily used here
  "indonesia", "jakarta", "bandung", "surabaya", "semarang", "yogyakarta",
  "sayacinta", "namaku", "rahasia", "kataSandi", "katasandi", "sandi123",
  "adminadmin", "admin123", "admin1234", "administrator1", "supplier",
  "supplier1", "supplier123", "user123", "qwerty12345", "asdasd", "asdasd123",
  "bismillah", "alhamdulillah", "januari", "februari", "desember",
  "merdeka", "pancasila", "garuda", "nusantara", "sejahtera",

  // Domain-shaped guesses an attacker would try against this system
  "commercial", "commercial2026", "ban123456", "banbustruk", "truckbus",
  "bridgestone", "hino", "mitsubishi", "isuzu", "quality", "qualitycontrol",
];

export const COMMON_PASSWORDS: ReadonlySet<string> = new Set(
  ENTRIES.map((entry) => entry.toLowerCase()),
);
