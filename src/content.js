const STATUS_STYLES = {
  essential: { rank: 0, label: "ESSENTIAL", background: "#dcfce7", border: "#16a34a" },
  cover: { rank: 1, label: "KEEP", background: "#dbeafe", border: "#2563eb" },
  redundant: { rank: 2, label: "REMOVABLE", background: "#f5f5f5", border: "#a3a3a3" },
  invalid: { rank: 3, label: "INVALID", background: "#fee2e2", border: "#dc2626" },
};
const FAILING_COLOR = "#dc2626";

function buildCell(tagName, text, extraStyle) {
  const cell = document.createElement(tagName);
  cell.textContent = text;
  cell.style.cssText = `border:1px solid #d4d4d4;padding:2px 6px;text-align:left;${extraStyle}`;
  return cell;
}

function buildHeading(text) {
  const heading = document.createElement("h3");
  heading.textContent = text;
  return heading;
}

function buildTable(columnTitles) {
  const table = document.createElement("table");
  table.style.borderCollapse = "collapse";
  const headerRow = table.insertRow();
  for (const title of columnTitles) {
    headerRow.append(buildCell("th", title, "background:#f5f5f5;"));
  }
  return table;
}

function buildNotesCell(report) {
  if (report.invalidReason !== null) {
    return buildCell("td", report.invalidReason, `color:${FAILING_COLOR};`);
  }
  if (report.failsStudentCode) {
    return buildCell("td", report.hints.join("; ") || "fails your code", `color:${FAILING_COLOR};font-weight:600;`);
  }
  return buildCell("td", "ok", "");
}

function compareReports(left, right) {
  const rankDifference = STATUS_STYLES[left.status].rank - STATUS_STYLES[right.status].rank;
  return rankDifference || left.name.localeCompare(right.name, undefined, { numeric: true });
}

function buildStudentTestSection(suiteReport) {
  const heading = buildHeading(`Student test suite: ${suiteReport.exposedBugCount}/${suiteReport.totalBugCount ?? "?"}`);
  const table = buildTable(["Test", "Status", "Exposes", "Only catcher of", "Notes"]);
  for (const report of [...suiteReport.testReports].sort(compareReports)) {
    const style = STATUS_STYLES[report.status];
    const row = table.insertRow();
    row.style.background = style.background;
    row.append(
      buildCell("td", report.name, ""),
      buildCell("td", style.label, `border-left:4px solid ${style.border};`),
      buildCell("td", report.bugs || "-", ""),
      buildCell("td", report.uniqueBugs || "-", ""),
      buildNotesCell(report),
    );
  }
  return [heading, table];
}

function buildInstructorTestSection(instructorSummary) {
  const { core, advanced, failures } = instructorSummary;
  const heading = buildHeading(
    `Instructor tests: core ${core.passed}/${core.total}, advanced ${advanced.passed}/${advanced.total}`,
  );
  if (failures.length === 0) {
    return [heading];
  }
  const table = buildTable(["Case", "Type", "Result"]);
  for (const failure of failures) {
    const row = table.insertRow();
    row.append(
      buildCell("td", String(failure.number), ""),
      buildCell("td", failure.advanced ? "advanced" : "core", ""),
      buildCell("td", failure.result, `color:${FAILING_COLOR};`),
    );
  }
  return [heading, table];
}

function buildPanel(parsedOutput) {
  const panel = document.createElement("div");
  if (parsedOutput.tests.size > 0) {
    panel.append(...buildStudentTestSection(analyzeSuite(parsedOutput)));
  }
  if (parsedOutput.instructorCases.length > 0) {
    panel.append(...buildInstructorTestSection(summarizeInstructorCases(parsedOutput.instructorCases)));
  }
  panel.append(document.createElement("hr"));
  return panel;
}

function run() {
  // textContent, not innerText: innerText is empty before first layout, which happens on soft reload
  const graderOutput = [...document.querySelectorAll("pre")].find((pre) =>
    pre.textContent.includes("grading student "),
  );
  if (graderOutput === undefined) {
    return;
  }
  const parsedOutput = parseGraderOutput(graderOutput.textContent);
  if (parsedOutput.tests.size === 0 && parsedOutput.instructorCases.length === 0) {
    return;
  }
  graderOutput.before(buildPanel(parsedOutput));
}

run();
