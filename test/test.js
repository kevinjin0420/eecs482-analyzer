const assert = require("node:assert");
const fs = require("node:fs");
const { parseGraderOutput, analyzeSuite, summarizeInstructorCases } = require("../src/analyze.js");

function analyzeSample(fileName) {
  const suite = analyzeSuite(parseGraderOutput(fs.readFileSync(`${__dirname}/${fileName}`, "utf8")));
  const keptBugs = new Set(
    suite.testReports.filter((report) => report.status !== "redundant").flatMap((report) => [...report.bugs]),
  );
  assert.strictEqual(keptBugs.size, suite.exposedBugCount, `${fileName}: kept tests lose coverage`);
  return { suite, byName: new Map(suite.testReports.map((report) => [report.name, report])) };
}

const pager = analyzeSample("sample-pager.txt");
assert.strictEqual(pager.suite.testReports.length, 25);
assert.strictEqual(pager.suite.exposedBugCount, 35);
assert.strictEqual(pager.suite.totalBugCount, 46);
assert.strictEqual(pager.byName.get("test9.4.cpp").uniqueBugs, "N");
assert.strictEqual(pager.byName.get("test24.4.cpp").status, "redundant");
assert.ok(pager.byName.get("test7.4.cpp").failsStudentCode);
assert.ok(!pager.byName.get("test0.4.cpp").failsStudentCode);

const threads = analyzeSample("sample-threads.txt");
assert.strictEqual(threads.suite.testReports.length, 9);
assert.strictEqual(threads.suite.exposedBugCount, 12);
assert.strictEqual(threads.suite.totalBugCount, 17);
assert.strictEqual(threads.byName.get("test1.cpp").uniqueBugs, "C");
assert.ok(threads.byName.get("test1.cpp").failsStudentCode);
assert.strictEqual(threads.byName.get("test2.cpp").status, "redundant");

const invalid = analyzeSample("sample-invalid.txt");
assert.strictEqual(invalid.suite.exposedBugCount, 6);
assert.strictEqual(invalid.byName.get("test1.cpp").status, "invalid");
assert.match(invalid.byName.get("test5.cpp").invalidReason, /too much memory/);
assert.strictEqual(invalid.byName.get("test3.cpp").status, "essential");
assert.strictEqual(invalid.byName.get("test4.cpp").status, "redundant");

const instructorOutput = parseGraderOutput(fs.readFileSync(`${__dirname}/sample-instructor.txt`, "utf8"));
assert.strictEqual(instructorOutput.tests.size, 0);
const instructor = summarizeInstructorCases(instructorOutput.instructorCases);
assert.deepStrictEqual(instructor.core, { passed: 46, total: 53 });
assert.deepStrictEqual(instructor.advanced, { passed: 16, total: 20 });
assert.deepStrictEqual(
  instructor.failures.map((failure) => failure.number),
  [28, 30, 51, 52, 61, 62, 68, 69, 70, 71, 72],
);
assert.strictEqual(instructor.failures[2].advanced, true);
assert.match(instructor.failures[9].result, /too much memory/);

const pending = summarizeInstructorCases(parseGraderOutput("------------------------- 0 * -----------------------\n").instructorCases);
assert.deepStrictEqual(pending.advanced, { passed: 0, total: 0 });

console.log("ok");
