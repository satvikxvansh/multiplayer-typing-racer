const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateProgress,
  calculateWpm,
  getMistypedWords,
} = require("../server/validation");

describe("Typing Progress and Mistake Resiliency", () => {
  const passage = "The old wooden clock.";

  test("typing correctly registers correct chars and completes cleanly", () => {
    const res = calculateProgress("The old wooden clock.", passage);
    assert.equal(res.isFinished, true);
    assert.equal(res.progressPercent, 100);
    assert.equal(res.correctChars, passage.length);
    assert.equal(res.incorrectChars, 0);
    assert.deepEqual(res.mistypedWords, []);
  });

  test("typing a wrong character does not stop subsequent correct characters from registering", () => {
    // User types 'x' instead of 'o' in "old": "The xld wooden clock."
    const res = calculateProgress("The xld wooden clock.", passage);
    
    // In "wooden" and "clock.", every character should be registered as correct
    assert.ok(res.correctChars >= 19, `Expected at least 19 correct chars, got ${res.correctChars}`);
    assert.ok(res.incorrectChars >= 1, `Expected at least 1 incorrect char, got ${res.incorrectChars}`);
    assert.deepEqual(res.mistypedWords, ["old"]);

    // "wooden" and "clock." characters must be marked 'correct' in charStates
    const woodenChars = res.charStates.filter(c => "wooden".includes(c.char) && c.state === "correct");
    assert.ok(woodenChars.length >= 6, "All characters of 'wooden' should be correct despite mistake in 'old'");
  });

  test("progress bar increases even when typing wrong characters or words", () => {
    const step1 = calculateProgress("The", passage);
    const step2 = calculateProgress("The ", passage);
    const step3 = calculateProgress("The x", passage); // wrong char typed
    const step4 = calculateProgress("The xl", passage);
    const step5 = calculateProgress("The xld ", passage); // completed wrong word

    assert.ok(step2.progressPercent >= step1.progressPercent);
    assert.ok(step3.progressPercent >= step2.progressPercent, "Progress should increase after typing wrong char");
    assert.ok(step4.progressPercent >= step3.progressPercent);
    assert.ok(step5.progressPercent >= step4.progressPercent, "Progress should increase after finishing wrong word");
  });

  test("race finishes and reaches 100% even if the racer made mistakes", () => {
    // Racer types with typos in multiple words: "The olld woden clock."
    const res = calculateProgress("The olld woden clock.", passage);
    assert.equal(res.isFinished, true, "Race should finish even with mistakes");
    assert.equal(res.progressPercent, 100, "Progress should reach 100% on completion");
    assert.ok(res.mistypedWords.includes("wooden") || res.mistypedWords.includes("old"));
  });

  test("omitted characters in completed words are counted as mistakes and do not desync next words", () => {
    // Racer types "od" instead of "old" (missed 'l'): "The od wooden clock."
    const res = calculateProgress("The od wooden clock.", passage);
    assert.equal(res.isFinished, true);
    assert.equal(res.progressPercent, 100);
    assert.deepEqual(res.mistypedWords, ["old"]);
    
    // Characters of "wooden" must be correctly registered
    const woodenMatch = res.charStates.slice(8, 14).every(c => c.state === "correct");
    assert.ok(woodenMatch, "Characters in 'wooden' must remain correct after an omitted letter in 'old'");
  });
});
