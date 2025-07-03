## Working with a coding agent

When working with a coding agent, please follow this workflow:

1.  **Run the development server yourself:** In a separate terminal, navigate to the project root and run `npm run dev`. Keep this terminal open to see real-time HMR updates in your browser.
2.  **Request changes from the agent:** Use the Gemini CLI terminal to ask the agent to modify code, add features, or fix bugs.
3.  **Agent will verify changes:** After making changes, the agent will automatically run `npm run build` or `npx tsc` to check for compilation or type errors. If errors occur, the agent will attempt to fix them.
4.  **Observe HMR updates:** Your browser, running `npm run dev`, will automatically reflect the agent's changes via HMR once they are successfully applied and verified.
5.  **Report errors to the agent:** If you encounter any runtime errors in your browser or in the terminal running `npm run dev`, please copy and paste the full error message to the agent for analysis and resolution.

## 🧪 Testing

This project uses Vitest for testing. Available test commands:

- `npm test` - Run tests once (for CI/production)
- `npm run test:watch` - Run tests in watch mode (for development)
- `npm run test:ui` - Run tests with UI interface

### Test Structure
- Unit tests are in the `/test/` directory
- Test utilities that reuse main classes are in `/src/grain-worker-test.ts`
- Tests focus on behavior verification rather than implementation details

## 🔄 Image Comparison Feature

After processing an image with grain, you can easily compare the original and processed versions:

### Toggle Methods:

* **Button**: Click the toggle button that appears after processing
* **Keyboard**: Press `SPACE` or `C` to quickly switch between versions
* **Visual Feedback**: The button shows which version is currently displayed

### Benefits:

* **Easy Comparison**: Instantly see the difference between original and processed images
* **Grain Inspection**: Use zoom + comparison to examine grain structure in detail
* **Quality Assessment**: Evaluate the grain effect and adjust settings if needed

### Usage Tips:

* Zoom in (200%+) to clearly see the grain texture
* Use keyboard shortcuts for rapid comparison
* The download button automatically downloads the currently displayed version