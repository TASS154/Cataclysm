export const rollDie = (sides) => Math.floor(Math.random() * sides) + 1;

export const dieSides = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20 };

export const parseDiceString = (diceString) => {
  const match = diceString.match(/(\d+)d(\d+)/);
  if (!match) return null;
  return { count: parseInt(match[1]), sides: parseInt(match[2]) };
};

export const rollDiceString = (diceString, modifier = 0) => {
  const parsed = parseDiceString(diceString);
  if (!parsed) return null;
  
  const results = [];
  let total = 0;
  
  for (let i = 0; i < parsed.count; i++) {
    const roll = rollDie(parsed.sides);
    results.push(roll);
    total += roll;
  }
  
  return {
    results,
    total: total + modifier,
    modifier,
    diceString,
    timestamp: Date.now()
  };
};

