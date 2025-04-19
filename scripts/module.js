"use strict";
import { libWrapper } from "./lib-wrapper-shim.js";
var plotDieActive = false;

// HTML Templates
function PLOT_DIE_CHECKBOX(dieActive) {
  return `
  <div class="form-group">
    <label>
      <input type="checkbox" name="plotDie" ${dieActive ? "checked" : ""}>
      Plot Die
    </label>
  </div>
`;
}



const COMPLICATION_CONTENT = `
  <div class="my-cool-message">
    <strong>Choose one of the following effects:</strong><br>
    <ul>
      <li><strong>Hinder an Ally:</strong> Your actions have unforeseen repercussions. The next test taken by a PC gains a disadvantage.</li>
      <li><strong>Become Distracted:</strong> You lose 1 focus.</li>
      <li><strong>Influence the Narrative:</strong> Your actions result in a narrative drawback of the GM’s choice.</li>
    </ul>
  </div>
`;

const OPPORTUNITY_CONTENT = `
  <div class="my-cool-message">
    <strong>Choose one of the following effects:</strong><br>
    <ul>
      <li><strong>Aid An Ally:</strong> The next test made by an ally gains an advantage.</li>
      <li><strong>Collect Yourself:</strong> You recover 1 focus.</li>
      <li><strong>Critically Hit:</strong> Change a hit into a critical hit.</li>
      <li><strong>Influence the Narrative:</strong> Create a positive narrative effect.</li>
    </ul>
  </div>
`;

// DOM Helpers
const createPlotDieFlavorElement = (bonus) => {
  const element = document.createElement("span");
  element.className = "tag tag_transparent";
  element.dataset.slug = "complication";
  element.dataset.visibility = "owner";
  element.textContent = `Complication +${bonus}`;
  return element;
};

// Hook Handlers
const handlePlotDieCheckboxChange = (event) => {
  plotDieActive = event.target.checked;
};

const handleCheckModifiersDialogRender = (app, html) => {
  if (html[0].classList.contains("roll-modifiers-dialog")) {
    plotDieActive = false;
  }
  const dialog = $(".roll-modifiers-dialog");

  dialog
    .find(".roll-mode-panel")
    .after(PLOT_DIE_CHECKBOX(plotDieActive))
    .next()
    .find('[name="plotDie"]')
    .on("change", handlePlotDieCheckboxChange);

  dialog.css("height", "auto");
};
// Roll Modification Logic
const modifyRollTerms = (roll, bonus) => {
  if (
    roll.terms.length === 3 &&
    roll.terms[1] instanceof foundry.dice.terms.OperatorTerm &&
    roll.terms[2] instanceof foundry.dice.terms.NumericTerm
  ) {
    const operatorTerm = roll.terms[1];
    const numericTerm = roll.terms[2];

    if (operatorTerm.operator === "+") {
      numericTerm.number += bonus;
    } else {
      numericTerm.number -= bonus;
      if (numericTerm.number < 0) {
        numericTerm.number = Math.abs(numericTerm.number);
        operatorTerm.operator = "+";
      }
    }

    if (numericTerm.number === 0) {
      roll.terms = roll.terms.slice(0, 1);
    }
  } else {
    roll.terms.push(
      new foundry.dice.terms.OperatorTerm({ operator: "+" }),
      new foundry.dice.terms.NumericTerm({ number: bonus })
    );
  }
  roll._formula = Roll.getFormula(roll.terms);
};

const loadMessageInPack = async (type) => {
  var content = ""
  const pack = game.packs.get("plot-die-pf2e.plot-die-results");
  const entry = await pack.getDocuments().then(entries => entries.find((entry => entry.name === type)));
  entry.pages.forEach(p => {
    content += p?.text.content;
  });
  if (content != ""){
    content = `
    <div class="my-cool-message">
    `+content+`
    </div>
    `
  }
  return content
}

// Chat Message Handling
const createPlotDieMessage = async (rollResult) => {
  const message = {
    rolls: [rollResult],
    flavor: "",
    speaker: { alias: "The Fate" },
    content: "<div></div>",
  };

  if ([1, 2].includes(rollResult.total)) {
    message.flavor = "A Complication occurs!";
    message.content = await loadMessageInPack("Complication") || COMPLICATION_CONTENT;
  } else if ([5, 6].includes(rollResult.total)) {
    message.flavor = "You get an Opportunity!";
    message.content = await loadMessageInPack("Opportunity") || OPPORTUNITY_CONTENT;
  } else {
    message.flavor = "Nothing special happens";
  }
  return message;
};

Hooks.on("renderCheckModifiersDialog", handleCheckModifiersDialogRender);

export class DiePlot extends foundry.dice.terms.Die {
  constructor(termData ) {
      termData.faces=6;
      super(termData);
  }

  /** @override */
  static DENOMINATION = "p";

}
Hooks.once("init", async function () {
  CONFIG.Dice.terms["p"] = DiePlot;
});



Hooks.once("diceSoNiceReady", (dice3d) => {
  dice3d.addSystem({id:"plot",name:"Plot"},"preferred");
  dice3d.addDicePreset({
    type: "dp",
    labels: [
      'modules/plot-die-pf2e/dsn/dice-images/face1.png',
      'modules/plot-die-pf2e/dsn/dice-images/face2.png',
      'modules/plot-die-pf2e/dsn/dice-images/face3.png',
      'modules/plot-die-pf2e/dsn/dice-images/face3.png',
      'modules/plot-die-pf2e/dsn/dice-images/face5.png',
      'modules/plot-die-pf2e/dsn/dice-images/face5.png'
    ],
    bumpMaps: [
      'modules/plot-die-pf2e/dsn/dice-bumps/face1.png',
      'modules/plot-die-pf2e/dsn/dice-bumps/face2.png',
      'modules/plot-die-pf2e/dsn/dice-bumps/face3.png',
      'modules/plot-die-pf2e/dsn/dice-bumps/face3.png',
      'modules/plot-die-pf2e/dsn/dice-bumps/face5.png',
      'modules/plot-die-pf2e/dsn/dice-bumps/face5.png'
    ],
    system: "plot",

  });
});
Hooks.once("init", async function () {
  libWrapper.register(
    "plot-die-pf2e",
    "game.pf2e.Check.roll",
    async function (original, ...args) {
      var plot_die_roll = await new Roll("1dp").roll();
      try {
        libWrapper.register(
          "plot-die-pf2e",
          "Roll.prototype.evaluate",
          function (wrapped, options = {}) {
            if (!plotDieActive || ![1, 2].includes(plot_die_roll.total)) {
              return wrapped(options);
            }

            modifyRollTerms(this, plot_die_roll.total * 2);
            this._plotDieFlavor = createPlotDieFlavorElement(
              plot_die_roll.total * 2
            );
            return wrapped(options);
          },
          "WRAPPER"
        );
        libWrapper.register(
          "plot-die-pf2e",
          "Roll.prototype.toMessage",
          function (wrapped, messageData = {}, options) {
            if (this._plotDieFlavor) {
              const flavorElement = document.createElement("div");
              flavorElement.innerHTML = messageData.flavor || "";

              let modifiersDiv = flavorElement.querySelector(".tags.modifiers");
              if (!modifiersDiv) {
                modifiersDiv = document.createElement("div");
                modifiersDiv.className = "tags modifiers";
                flavorElement.appendChild(modifiersDiv);
              }

              modifiersDiv.appendChild(this._plotDieFlavor.cloneNode(true));
              messageData.flavor = flavorElement.innerHTML;

              messageData.flags ??= {};
              messageData.flags.pf2e ??= { modifiers: [] };
              messageData.flags.pf2e.modifiers.push({
                slug: "complication",
                label: "Complication",
                modifier: plot_die_roll.total * 2,
                type: "fate",
                // ... (keep original modifier properties)
              });
            }
            return wrapped(messageData, options);
          },
          "WRAPPER"
        );
        const result = await original(...args);
        if (result && plotDieActive) {
          await ChatMessage.create(await createPlotDieMessage(plot_die_roll));
        }
        return result;
      } finally {
        libWrapper.unregister("plot-die-pf2e", "Roll.prototype.evaluate");
        libWrapper.unregister("plot-die-pf2e", "Roll.prototype.toMessage");
      }
    },
    "WRAPPER"
  );
});
