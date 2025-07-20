// Test file to verify ESLint rule
const numbers = [1, 2, 3, 4, 5];
const max = Math.max(...numbers); // This should trigger the rule
const min = Math.min(...numbers); // This should also trigger the rule
