const HEADER_PATTERN = /^------ grading student test case (\S+) ------$/;
const EXPOSED_PATTERN = /^student test case (\S+) exposed the following instructor buggy .+?: (\S*)$/;
const INVALID_PATTERN = /^student test case (\S+) is invalid: (.+)$/;
const INSTRUCTOR_CASE_PATTERN = /^-{5,} (\d+)( \*)? -{5,}$/;
const HINT_PATTERN = /^hint: (.+)$/;
const SUMMARY_PATTERN = /exposed (\d+) of the (\d+) instructor buggy/;
const FAILING_LIST_PATTERN = /following student test cases exposed the student .+? as buggy: (.+)$/;

function parseGraderOutput(graderText) {
  if (typeof graderText !== "string") {
    throw new TypeError("graderText must be a string");
  }
  const tests = new Map();
  const failingTestNames = new Set();
  const instructorCases = [];
  let currentTest = null;
  let currentInstructorCase = null;
  let totalBugCount = null;

  for (const rawLine of graderText.split("\n")) {
    const line = rawLine.trim();

    const headerMatch = HEADER_PATTERN.exec(line);
    if (headerMatch !== null) {
      currentTest = { name: headerMatch[1], bugs: new Set(), hints: [], invalidReason: null };
      tests.set(currentTest.name, currentTest);
      continue;
    }

    const instructorCaseMatch = INSTRUCTOR_CASE_PATTERN.exec(line);
    if (instructorCaseMatch !== null) {
      currentTest = null;
      currentInstructorCase = {
        number: Number(instructorCaseMatch[1]),
        advanced: instructorCaseMatch[2] !== undefined,
        result: null,
      };
      instructorCases.push(currentInstructorCase);
      continue;
    }

    if (currentInstructorCase !== null && currentInstructorCase.result === null && line !== "") {
      currentInstructorCase.result = line;
      continue;
    }

    const exposedMatch = EXPOSED_PATTERN.exec(line);
    if (exposedMatch !== null) {
      const exposingTest = tests.get(exposedMatch[1]);
      if (exposingTest !== undefined) {
        for (const bugLetter of exposedMatch[2]) {
          exposingTest.bugs.add(bugLetter);
        }
      }
      continue;
    }

    const invalidMatch = INVALID_PATTERN.exec(line);
    if (invalidMatch !== null) {
      const invalidTest = tests.get(invalidMatch[1]);
      if (invalidTest !== undefined) {
        invalidTest.invalidReason = invalidMatch[2];
      }
      continue;
    }

    const hintMatch = HINT_PATTERN.exec(line);
    if (hintMatch !== null && currentTest !== null) {
      currentTest.hints.push(hintMatch[1]);
      continue;
    }

    const summaryMatch = SUMMARY_PATTERN.exec(line);
    if (summaryMatch !== null) {
      totalBugCount = Number(summaryMatch[2]);
      continue;
    }

    const failingListMatch = FAILING_LIST_PATTERN.exec(line);
    if (failingListMatch !== null) {
      for (const testName of failingListMatch[1].split(/\s+/)) {
        failingTestNames.add(testName);
      }
    }
  }

  return { tests, failingTestNames, totalBugCount, instructorCases };
}

function analyzeSuite(parsedOutput) {
  const { tests, failingTestNames } = parsedOutput;
  const failsStudentCode = (test) => failingTestNames.has(test.name) || test.hints.length > 0;

  const exposerCountByBug = new Map();
  for (const test of tests.values()) {
    for (const bugLetter of test.bugs) {
      exposerCountByBug.set(bugLetter, (exposerCountByBug.get(bugLetter) ?? 0) + 1);
    }
  }
  const uniqueBugsOf = (test) => [...test.bugs].filter((bugLetter) => exposerCountByBug.get(bugLetter) === 1);

  const keptNames = new Set();
  const uncoveredBugs = new Set(exposerCountByBug.keys());
  const keepTest = (test) => {
    keptNames.add(test.name);
    for (const bugLetter of test.bugs) {
      uncoveredBugs.delete(bugLetter);
    }
  };

  for (const test of tests.values()) {
    if (uniqueBugsOf(test).length > 0) {
      keepTest(test);
    }
  }

  // ponytail: greedy set cover, can keep one more test than optimal; swap for exact search if that matters
  while (uncoveredBugs.size > 0) {
    let bestTest = null;
    let bestGain = 0;
    for (const test of tests.values()) {
      if (keptNames.has(test.name)) {
        continue;
      }
      const gain = [...test.bugs].filter((bugLetter) => uncoveredBugs.has(bugLetter)).length;
      const tiesButAvoidsFailure =
        gain === bestGain && gain > 0 && failsStudentCode(bestTest) && !failsStudentCode(test);
      if (gain > bestGain || tiesButAvoidsFailure) {
        bestTest = test;
        bestGain = gain;
      }
    }
    if (bestTest === null) {
      break;
    }
    keepTest(bestTest);
  }

  const testReports = [...tests.values()].map((test) => {
    const uniqueBugs = uniqueBugsOf(test);
    let status = "redundant";
    if (test.invalidReason !== null) {
      status = "invalid";
    } else if (uniqueBugs.length > 0) {
      status = "essential";
    } else if (keptNames.has(test.name)) {
      status = "cover";
    }
    return {
      name: test.name,
      bugs: [...test.bugs].sort().join(""),
      uniqueBugs: uniqueBugs.sort().join(""),
      status,
      failsStudentCode: failsStudentCode(test),
      hints: test.hints,
      invalidReason: test.invalidReason,
    };
  });

  return {
    testReports,
    exposedBugCount: exposerCountByBug.size,
    totalBugCount: parsedOutput.totalBugCount,
  };
}

function summarizeInstructorCases(instructorCases) {
  const finishedCases = instructorCases.filter((instructorCase) => instructorCase.result !== null);
  const tally = (cases) => ({
    passed: cases.filter((instructorCase) => instructorCase.result === "perfect!").length,
    total: cases.length,
  });
  return {
    core: tally(finishedCases.filter((instructorCase) => !instructorCase.advanced)),
    advanced: tally(finishedCases.filter((instructorCase) => instructorCase.advanced)),
    failures: finishedCases.filter((instructorCase) => instructorCase.result !== "perfect!"),
  };
}

if (typeof module !== "undefined") {
  module.exports = { parseGraderOutput, analyzeSuite, summarizeInstructorCases };
}
