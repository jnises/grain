## Working with a coding agent

When working with a coding agent, please follow this workflow:

1.  **Run the development server yourself:** In a separate terminal, navigate to the project root and run `npm run dev`. Keep this terminal open to see real-time HMR updates in your browser.
2.  **Request changes from the agent:** Use the Gemini CLI terminal to ask the agent to modify code, add features, or fix bugs.
3.  **Agent will verify changes:** After making changes, the agent will automatically run `npm run build` or `npx tsc` to check for compilation or type errors. If errors occur, the agent will attempt to fix them.
4.  **Observe HMR updates:** Your browser, running `npm run dev`, will automatically reflect the agent's changes via HMR once they are successfully applied and verified.
5.  **Report errors to the agent:** If you encounter any runtime errors in your browser or in the terminal running `npm run dev`, please copy and paste the full error message to the agent for analysis and resolution.