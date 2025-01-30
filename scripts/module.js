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

// Chat Message Handling
const createPlotDieMessage = (rollResult) => {
  const message = {
    rolls: [rollResult],
    flavor: "",
    speaker: { alias: "The Fate" },
    content: "",
  };

  if ([1, 2].includes(rollResult.total)) {
    message.flavor = "A Complication occurs!";
    message.content = COMPLICATION_CONTENT;
  } else if ([5, 6].includes(rollResult.total)) {
    message.flavor = "You get an Opportunity!";
    message.content = OPPORTUNITY_CONTENT;
  } else {
    message.flavor = "Nothing special happens";
  }

  return message;
};

Hooks.on("renderCheckModifiersDialog", handleCheckModifiersDialogRender);
// Hooks.on("renderCheckModifiersDialog", (app, html, data) => {
//   if(html[0].classList.contains("roll-modifiers-dialog")){
//     plotDieActive = false;
//   }

//   var dialog = $(".roll-modifiers-dialog");
//   const checkbox = `<div class="form-group">
//     <label><input type="checkbox" name="plotDie" ${plotDieActive ? "checked" : ""}> Plot Die</label>
//   </div>`;
//   dialog.find(".roll-mode-panel").after(checkbox);
//   dialog.find('[name="plotDie"]').on("change", (event) => {
//     plotDieActive = event.target.checked;
//   });
//   dialog.css("height", "auto");
// });

Hooks.once("init", async function () {
  libWrapper.register(
    "plot-die-pf2e",
    "game.pf2e.Check.roll",
    async function (original, ...args) {
      var plot_die_roll = await new Roll("1d6[plot]").roll();
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
        // libWrapper.register(
        //   "plot-die-pf2e",
        //   "Roll.prototype.evaluate",
        //   function evaluate(wrapped, options = {}) {
        //     if (
        //       !plotDieActive ||
        //       (plot_die_roll._total != 1 && plot_die_roll._total != 2)
        //     ) {
        //       return wrapped(options);
        //     }
        //     var bonus = plot_die_roll._total * 2;
        //     if (
        //       this.terms.length === 3 &&
        //       this.terms[1] instanceof foundry.dice.terms.OperatorTerm &&
        //       this.terms[2] instanceof foundry.dice.terms.NumericTerm
        //     ) {
        //       var number = this.terms[2].number;
        //       if (this.terms[1].operator === "+") {
        //         number += bonus;
        //       } else {
        //         number = number - bonus;
        //         if (number < 0) {
        //           number = abs(number);
        //           this.terms[1].operator = "+";
        //         }
        //       }
        //       this.terms[2].number = number;
        //       if (number === 0) {
        //         this.terms = this.terms.slice(0, 1);
        //       }
        //     } else {
        //       this.terms.push(
        //         new foundry.dice.terms.OperatorTerm({ operator: "+" })
        //       );
        //       this.terms.push(
        //         new foundry.dice.terms.NumericTerm({
        //           number: bonus,
        //         })
        //       );
        //     }

        //     this._formula = this.constructor.getFormula(this.terms);
        //     this._plotDieFlavor = document.createElement("span");
        //     this._plotDieFlavor.className = "tag tag_transparent";
        //     this._plotDieFlavor.dataset.slug = "complication";
        //     this._plotDieFlavor.dataset.visibility = "owner";
        //     this._plotDieFlavor.textContent = `Complication +${bonus}`;
        //     return wrapped(options);
        //   },
        //   "WRAPPER"
        // );
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
        // libWrapper.register(
        //   "plot-die-pf2e",
        //   "Roll.prototype.toMessage",
        //   function (wrapped, messageData = {}, options) {
        //     if (this._plotDieFlavor) {
        //       const parser = new DOMParser();
        //       const doc = parser.parseFromString(
        //         messageData.flavor || "",
        //         "text/html"
        //       );
        //       let modifiersDiv = doc.querySelector(".tags.modifiers");
        //       if (!modifiersDiv) {
        //         modifiersDiv = doc.createElement("div");
        //         modifiersDiv.className = "tags modifiers";
        //         doc.body.appendChild(modifiersDiv);
        //       }
        //       modifiersDiv.appendChild(this._plotDieFlavor);
        //       messageData.flavor = doc.body.innerHTML;
        //       messageData.flags.pf2e.modifiers.push({
        //         ability: null,
        //         adjustments: [],
        //         critical: null,
        //         custom: false,
        //         damageCategory: null,
        //         damageType: null,
        //         domains: [],
        //         enabled: true,
        //         force: false,
        //         hideIfDisabled: false,
        //         ignored: false,
        //         kind: "modifier",
        //         label: "Complication",
        //         modifier: plot_die_roll._total * 2,
        //         predicate: [],
        //         slug: "complication",
        //         source: null,
        //         tags: [],
        //         type: "fate",
        //       });
        //     }
        //     return wrapped(messageData, options);
        //   },
        //   "MIXED"
        // );
        const result = await original(...args);
        if (result && plotDieActive) {
          await ChatMessage.create(createPlotDieMessage(plot_die_roll));
        }
        return result;

        //       var result = original(...args);
        //       var result2 = result
        //         .then(async (res) => {
        //           if (res == null || !plotDieActive) return res;
        //           var chatData = {
        //             rolls: [plot_die_roll],
        //             flavor: "",
        //             speaker: { alias: "The Fate" },
        //           };
        //           switch (plot_die_roll._total) {
        //             case 1:
        //             case 2:
        //               chatData.flavor = "A Complication occurs!";
        //               chatData.content = `
        // 					<div class="my-cool-message">
        // 					<strong>Choose one of the following effects:</strong><br>
        // 					<ul>
        // 						<li><strong>Hinder an Ally:</strong> Your actions have unforeseen repercussions. The next test taken by a PC gains a disadvantage.</li>
        // 						<li><strong>Become Distracted:</strong> You lose 1 focus.</li>
        // 						<li><strong>Influence the Narrative:</strong> Your actions result in a narrative drawback of the GM’s choice. This effect occurs regardless of whether the test succeeds or fails.</li>
        // 					</ul>
        // 					</div>
        // 					`;
        //               break;
        //             case 5:
        //             case 6:
        //               chatData.flavor = "You get an Opportunity!";
        //               chatData.content = `
        // 					<div class="my-cool-message">
        // 					<strong>Choose one of the following effects:</strong><br>
        // 					<ul>
        // 						<li><strong>Aid An Ally:</strong> Thanks to your actions, the next test made by an ally of your choice gains an advantage.</li>
        // 						<li><strong>Collect Yourself:</strong> You recover 1 focus.</li>
        // 						<li><strong>Critically Hit:</strong> You change a hit into a critical hit (see “Attacking” in Part 5). You can only use this effect on attack tests.</li>
        // 						<li><strong>Influence the Narrative:</strong> Your actions result in a positive narrative effect of your choice, which the GM must approve. This effect occurs regardless of whether the test succeeds or fails</li>
        // 					</ul>
        // 					</div>
        // `;
        //               break;
        //             default:
        //               chatData.flavor = "Nothing special happens";
        //               chatData.content = "";
        //           }
        //           ChatMessage.create(chatData);
        //           return res;
        //         })
        //         .finally(() => {
        //           libWrapper.unregister("plot-die-pf2e", "Roll.prototype.evaluate");
        //           libWrapper.unregister("plot-die-pf2e", "Roll.prototype.toMessage");
        //         });

        //       return result2;
      } finally {
        libWrapper.unregister("plot-die-pf2e", "Roll.prototype.evaluate");
        libWrapper.unregister("plot-die-pf2e", "Roll.prototype.toMessage");
      }
    },
    "WRAPPER"
  );
});
