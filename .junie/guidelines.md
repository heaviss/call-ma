Guidelines

Follow a test-driven, incremental development process with clear, minimalist code and thorough testing. 
Before coding, outline a solution plan. 
Use TDD: write failing tests for each feature, run them, and iteratively implement code to pass the tests. 
After each small step (writing tests or code), run the tests and commit changes. 

Key guidelines:
    • Follow TDD: Always write tests first (Arrange/Act/Assert blocks separated by blank lines) and confirm they fail before implementing functionality.
    • Clear, Minimal Code: Do not write unnecessary comments or docstrings. If comments are used, explain why a decision is made, not what the code does.
    • English Only: Use English for all code, variable names, and test descriptions.
    • DRY and Readability: Avoid code duplication unless it significantly improves clarity. Favor clear, simple solutions over premature abstraction.
    • Fixtures & Modules: Use test fixtures for repeated setup. Check for existing fixtures before creating new ones. Organize code into small modules/functions.
    • Edge Case Testing: For each function or module, write tests covering valid inputs, invalid inputs, and edge cases. Avoid testing trivial getters/setters or private/internal helper methods.
    • Integration Over Mocking: Prefer using real objects in tests. Only mock external dependencies when absolutely necessary. Do not test external libraries.
    • Iterative Workflow: Develop in small increments. For each new feature or fix: plan → write tests → run and fail → implement → run and pass → commit.
    • Project Structure: Keep the monorepo organized with separate folders for source code, tests, and configuration. Ensure the frontend build and tests run via Vite/Vitest.
    • Code Style: Adhere to the chosen linting rules (ESLint/Prettier). Use modern ES6+ syntax (e.g. import/export). Ensure code passes linting and formatting checks.
    • PWA Requirements: Generate a valid manifest.json and service worker file automatically if possible.
    • Error Handling: If any step is unclear, ask for clarification rather than guessing.

Each feature must be accompanied by appropriate tests. 
Use a planning step for complex features.
