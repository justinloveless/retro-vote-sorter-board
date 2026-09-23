import assert from "node:assert/strict";
import { buildIssueDescription } from "./create-linear-issue-from-github.mjs";

const withBody = buildIssueDescription({
  body: "Something broke in poker.",
  issueUrl: "https://github.com/justinloveless/retro-vote-sorter-board/issues/999",
  issueNumber: "999",
  repository: "justinloveless/retro-vote-sorter-board",
});

assert.match(withBody, /Something broke in poker/);
assert.match(
  withBody,
  /\[#999\]\(https:\/\/github\.com\/justinloveless\/retro-vote-sorter-board\/issues\/999\)/
);
assert.match(withBody, /justinloveless\/retro-vote-sorter-board/);

const emptyBody = buildIssueDescription({
  body: "   ",
  issueUrl: "https://example.com/issues/1",
  issueNumber: "1",
  repository: "org/repo",
});
assert.equal(
  emptyBody,
  "---\n\nSynced from GitHub issue [#1](https://example.com/issues/1) in `org/repo`."
);

console.log("create-linear-issue-from-github.test.mjs: ok");
