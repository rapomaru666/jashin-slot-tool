document.addEventListener("DOMContentLoaded", () => {

  const state = {
    koakuma: 0,
    big: 0,
    episode: 0
  };

  const hints = {};

  // 2026-08-10時点 公開値
  const bonusRates = [253.1, 248.1, 241.6, 222.5, 211.8, 210.0];

  /*
   * 弱・強示唆の補正。
   * 公開されているのは傾向のみで出現率数値は未公表のため、
   * ここでは候補の優先度を付けるための相対補正として扱う。
   * 濃厚・否定系のみ設定候補を0%除外する。
   */
  const softHints = {
    // 小悪魔BONUS中 キャラ紹介
    char_minos:        { odd: 0.025 },
    char_pekora:       { odd: 0.025 },
    char_kyonkyon:     { odd: 0.025 },
    char_ranran:       { odd: 0.025 },

    char_medusa:       { even: 0.025 },
    char_persephone2:  { even: 0.025 },
    char_pino:         { even: 0.025 },
    char_poporon:      { even: 0.025 },

    char_mei:          { high: 0.030 },
    char_lierre:       { high: 0.030 },
    char_persephone1:  { high: 0.030 },
    char_ecute:        { high: 0.060 },
    char_atre:         { high: 0.060 },

    // AT終了画面
    at_minos:          { odd: 0.025 },
    at_medusa:         { odd: 0.050 },
    at_pekora:         { even: 0.025 },
    at_poporon:        { even: 0.050 },
    at_yurine_a:       { high: 0.030 },
    at_yurine_b:       { high: 0.060 },

    // うれしいちゃんす シール
    seal_mei:          { odd: 0.025 },
    seal_kyonran:      { odd: 0.050 },
    seal_yusahyou:     { even: 0.025 },
    seal_pinopoporon:  { even: 0.050 },
    seal_persephone2:  { high: 0.045 }
  };

  // 設定○以上濃厚
  const minimums = {
    char_perfect: 4,
    char_demon_yurine: 6,

    at_akudakumi: 2,
    at_swimsuit: 4,
    at_pajamas: 5,
    at_all: 6,

    seal_lierre_persephone1: 4,
    seal_ecute_atre: 6,

    koakuma_high4: 4,
    koakuma_ecute_atre_same: 2
  };

  // 設定否定系
  const denials = {
    char_justice: [1],
    char_fighter: [2],
    char_commander: [3],
    char_esp: [1, 2],
    char_genius: [1, 3]
  };

  function getValue(id) {
    return Number(hints[id] || 0);
  }

  function setValue(id, value) {
    hints[id] = Math.max(0, value);
    const element = document.getElementById(`${id}-value`);
    if (element) element.textContent = hints[id];
  }

  document.querySelectorAll(".counter-btn").forEach(button => {
    button.addEventListener("click", () => {
      const target = button.dataset.target;
      if (!target) return;

      const amount = button.classList.contains("plus") ? 1 : -1;

      if (Object.prototype.hasOwnProperty.call(state, target)) {
        state[target] = Math.max(0, state[target] + amount);
        const element = document.getElementById(`${target}-value`);
        if (element) element.textContent = state[target];
        return;
      }

      setValue(target, getValue(target) + amount);
    });
  });

  function getBonusTotal() {
    return state.koakuma + state.big + state.episode;
  }

  function logFactorial(n) {
    let result = 0;
    for (let i = 2; i <= n; i++) result += Math.log(i);
    return result;
  }

  function baseProbabilities(games, bonusCount) {
    if (!games || bonusCount <= 0) return [1, 1, 1, 1, 1, 1];

    const logs = bonusRates.map(rate => {
      const lambda = games / rate;
      return bonusCount * Math.log(lambda) - lambda - logFactorial(bonusCount);
    });

    const max = Math.max(...logs);
    return logs.map(value => Math.exp(value - max));
  }

  function getTrophyMinimum() {
    const trophy = document.getElementById("trophy");
    if (!trophy) return 1;

    const values = {
      none: 1,
      copper: 2,
      silver: 3,
      gold: 4,
      kumanomi: 5,
      rainbow: 6
    };

    return values[trophy.value] || 1;
  }

  function getMinimumSetting() {
    let minimum = getTrophyMinimum();

    for (const [id, setting] of Object.entries(minimums)) {
      if (getValue(id) > 0) minimum = Math.max(minimum, setting);
    }

    // 1回の小悪魔BONUS内で高設定期待度UPキャラが4回出現なら設定4以上濃厚。
    // 2回・3回は「期待度UP」であり濃厚ではないため最低設定固定にはしない。
    return minimum;
  }

  function applySoftHints(probabilities) {
    let result = probabilities.map((probability, index) => {
      const setting = index + 1;
      let multiplier = 1;

      for (const [id, hint] of Object.entries(softHints)) {
        const count = getValue(id);
        if (!count) continue;

        if (hint.odd && setting % 2 === 1) multiplier *= 1 + hint.odd * count;
        if (hint.even && setting % 2 === 0) multiplier *= 1 + hint.even * count;
        if (hint.high && setting >= 4) multiplier *= 1 + hint.high * count;
      }

      return probability * multiplier;
    });

    // 1回の小悪魔BONUS内の高設定期待度UPキャラ回数。
    // 2回→設定2以上期待度UP、3回→設定3以上期待度UP。
    const high2 = getValue("koakuma_high2");
    const high3 = getValue("koakuma_high3");

    if (high2 > 0) {
      result = result.map((v, i) => v * (i + 1 >= 2 ? 1 + 0.05 * high2 : 1));
    }
    if (high3 > 0) {
      result = result.map((v, i) => v * (i + 1 >= 3 ? 1 + 0.08 * high3 : 1));
    }

    return result;
  }

  function applyMinimum(probabilities, minimum) {
    return probabilities.map((value, index) => (index + 1 < minimum ? 0 : value));
  }

  function applyDenials(probabilities) {
    const deniedSettings = new Set();

    for (const [id, settings] of Object.entries(denials)) {
      if (getValue(id) > 0) settings.forEach(setting => deniedSettings.add(setting));
    }

    return probabilities.map((value, index) => deniedSettings.has(index + 1) ? 0 : value);
  }

  function normalize(values) {
    const total = values.reduce((sum, value) => sum + value, 0);
    if (!total) return values.map(() => 0);
    return values.map(value => value / total * 100);
  }

  function updateGraph(probabilities) {
    for (let setting = 1; setting <= 6; setting++) {
      const percentage = probabilities[setting - 1] || 0;
      const text = document.getElementById(`setting-percent-${setting}`);
      const bar = document.getElementById(`setting-bar-${setting}`);

      if (text) text.textContent = `${Math.round(percentage)}%`;
      if (bar) bar.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
    }
  }

  function updatePrediction(probabilities) {
    const max = Math.max(...probabilities);
    const element = document.getElementById("prediction-text");
    if (!element) return;

    if (!max) {
      element.textContent = "設定予測：判定材料が矛盾しています";
      return;
    }

    const candidates = probabilities
      .map((value, index) => ({ value, setting: index + 1 }))
      .filter(item => Math.abs(item.value - max) < 0.5)
      .map(item => item.setting);

    if (candidates.length === 1) {
      element.textContent = `設定予測：設定${candidates[0]}が最有力`;
    } else {
      element.textContent = `設定予測：設定${candidates[0]}～${candidates[candidates.length - 1]}が候補`;
    }
  }

  function judge() {
    const games = Number(document.getElementById("games")?.value || 0);

    if (!games || games <= 0) {
      alert("総ゲーム数を入力してください。");
      document.getElementById("games")?.focus();
      return;
    }

    const bonusCount = getBonusTotal();
    let probabilities = baseProbabilities(games, bonusCount);

    probabilities = applySoftHints(probabilities);
    probabilities = applyMinimum(probabilities, getMinimumSetting());
    probabilities = applyDenials(probabilities);
    probabilities = normalize(probabilities);

    updateGraph(probabilities);
    updatePrediction(probabilities);

    const result = document.getElementById("result-section");
    if (result) {
      result.classList.add("visible");
      setTimeout(() => {
        result.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  }

  function reset() {
    state.koakuma = 0;
    state.big = 0;
    state.episode = 0;

    ["koakuma", "big", "episode"].forEach(id => {
      const element = document.getElementById(`${id}-value`);
      if (element) element.textContent = "0";
    });

    Object.keys(hints).forEach(id => delete hints[id]);

    document.querySelectorAll(".counter span[id$='-value']").forEach(element => {
      element.textContent = "0";
    });

    const games = document.getElementById("games");
    if (games) games.value = "";

    const trophy = document.getElementById("trophy");
    if (trophy) trophy.value = "none";

    for (let setting = 1; setting <= 6; setting++) {
      const text = document.getElementById(`setting-percent-${setting}`);
      const bar = document.getElementById(`setting-bar-${setting}`);
      if (text) text.textContent = "0%";
      if (bar) bar.style.width = "0%";
    }

    const prediction = document.getElementById("prediction-text");
    if (prediction) prediction.textContent = "-";

    document.getElementById("result-section")?.classList.remove("visible");
  }

  document.getElementById("judge-btn")?.addEventListener("click", judge);
  document.getElementById("reset-btn")?.addEventListener("click", reset);

});