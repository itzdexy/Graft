export const PR_TITLE = 'Add Blink GitHub Workflow'

export const GITHUB_ACTION_SETUP_DOCS_URL =
  'https://github.com/itsdexy/BlinkCode'

export const WORKFLOW_CONTENT = `name: Blink

on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  issues:
    types: [opened, assigned]
  pull_request_review:
    types: [submitted]

jobs:
  blink:
    if: |
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@blink')) ||
      (github.event_name == 'pull_request_review_comment' && contains(github.event.comment.body, '@blink')) ||
      (github.event_name == 'pull_request_review' && contains(github.event.review.body, '@blink')) ||
      (github.event_name == 'issues' && (contains(github.event.issue.body, '@blink') || contains(github.event.issue.title, '@blink')))
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
      issues: read
      id-token: write
      actions: read # Required for Blink to read CI results on PRs
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Run Blink
        id: blink
        uses: itsdexy/BlinkCode@main
        with:
          blink_api_key: \${{ secrets.BLINK_API_KEY }}

          # This is an optional setting that allows Blink to read CI results on PRs
          additional_permissions: |
            actions: read

          # Optional: Give a custom prompt to Blink. If this is not specified, Blink will perform the instructions specified in the comment that tagged it.
          # prompt: 'Update the pull request description to include a summary of changes.'

          # Optional: Add blink_args to customize behavior and configuration
          # See https://github.com/itsdexy/BlinkCode
          # or https://github.com/itsdexy/BlinkCode for available options
          # blink_args: '--allowed-tools Bash(gh pr:*)'

`

export const PR_BODY = `## 🤖 Installing Blink GitHub App

This PR adds a GitHub Actions workflow that enables Blink integration in our repository.

### What is Blink?

[Blink](https://github.com/itsdexy/BlinkCode) is an AI coding agent that can help with:
- Bug fixes and improvements  
- Documentation updates
- Implementing new features
- Code reviews and suggestions
- Writing tests
- And more!

### How it works

Once this PR is merged, we'll be able to interact with Blink by mentioning @blink in a pull request or issue comment.
Once the workflow is triggered, Blink will analyze the comment and surrounding context, and execute on the request in a GitHub action.

### Important Notes

- **This workflow won't take effect until this PR is merged**
- **@blink mentions won't work until after the merge is complete**
- The workflow runs automatically whenever Blink is mentioned in PR or issue comments
- Blink gets access to the entire PR or issue context including files, diffs, and previous comments

### Security

- Our Blink API key is securely stored as a GitHub Actions secret
- Only users with write access to the repository can trigger the workflow
- All Blink runs are stored in the GitHub Actions run history
- Blink's default tools are limited to reading/writing files and interacting with our repo by creating comments, branches, and commits.
- We can add more allowed tools by adding them to the workflow file like:

\`\`\`
allowed_tools: Bash(npm install),Bash(npm run build),Bash(npm run lint),Bash(npm run test)
\`\`\`

There's more information in the [Blink action repo](https://github.com/itsdexy/BlinkCode).

After merging this PR, let's try mentioning @blink in a comment on any PR to get started!`

export const CODE_REVIEW_PLUGIN_WORKFLOW_CONTENT = `name: Blink Review

on:
  pull_request:
    types: [opened, synchronize, ready_for_review, reopened]
    # Optional: Only run on specific file changes
    # paths:
    #   - "src/**/*.ts"
    #   - "src/**/*.tsx"
    #   - "src/**/*.js"
    #   - "src/**/*.jsx"

jobs:
  blink-review:
    # Optional: Filter by PR author
    # if: |
    #   github.event.pull_request.user.login == 'external-contributor' ||
    #   github.event.pull_request.user.login == 'new-developer' ||
    #   github.event.pull_request.author_association == 'FIRST_TIME_CONTRIBUTOR'

    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
      issues: read
      id-token: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Run Blink Review
        id: blink-review
        uses: itsdexy/BlinkCode@main
        with:
          blink_api_key: \${{ secrets.BLINK_API_KEY }}
          plugin_marketplaces: 'https://github.com/itsdexy/BlinkCode.git'
          plugins: 'code-review@blink-plugins'
          prompt: '/code-review:code-review \${{ github.repository }}/pull/\${{ github.event.pull_request.number }}'
          # See https://github.com/itsdexy/BlinkCode
          # or https://github.com/itsdexy/BlinkCode for available options

`
