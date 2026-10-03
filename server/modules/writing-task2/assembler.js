// Lap bai mau tu: khung (shape) + the y (cards) + cac cho dien trong recipe.
// Khong goi AI: bai nao cung duoc "ghep" tu cung mot thu vien nho -> van phong dong nhat.

const upperFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

function fill(template, slots) {
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    if (slots[k] === undefined) throw new Error(`Thieu slot {${k}} trong: ${template}`);
    return slots[k];
  });
}

function normCards(recipe) {
  return recipe.cards.map((c) => (typeof c === 'string' ? { id: c, act: recipe.act } : { id: c[0], act: c[1] || recipe.act }));
}

// "since <act> <pred1> and <pred2>"  hoac  "since <act1> <pred1>, while <act2> <pred2>"
function reasons(cards, lib) {
  const [a, b] = cards;
  const pa = lib.cards[a.id].pred, pb = lib.cards[b.id].pred;
  return a.act === b.act ? `${a.act} ${pa} and ${pb}` : `${a.act} ${pa}, while ${b.act} ${pb}`;
}

function shorts(cards, lib) {
  return `${lib.cards[cards[0].id].short}, as well as ${lib.cards[cards[1].id].short}`;
}

function body(card, lib, recipe, connector, opts = {}) {
  const def = lib.cards[card.id];
  if (!def) throw new Error(`Khong co the ${card.id}`);
  const slots = {
    act: card.act,
    who: recipe.who || 'students',
    problem: opts.problem || recipe.problem || '',
    field: recipe.field || 'education',
  };
  const sentences = def.s.slice(0, opts.n || 4).map((s) => fill(s, slots));
  const first = connector ? `${connector} ${lowerFirst(sentences[0])}` : upperFirst(sentences[0]);
  const out = [first, ...sentences.slice(1)];
  if (opts.ex !== false && def.ex) out.push(def.ex);
  return out.join(' ');
}

export function assemble(recipe, lib, qtype) {
  const odd = recipe.id % 2 === 1;
  const cards = normCards(recipe);
  const t = { 'Agree / Disagree': 'AD', Extent: 'EX', Opinion: 'OP' }[qtype] || 'OP';
  const first = odd ? 'To begin with,' : 'First and foremost,';
  const second = odd ? 'Furthermore,' : 'In addition,';
  const P = {};

  switch (recipe.shape) {
    case 'AGREE': {
      const open = odd ? `A growing number of people believe that ${recipe.claim}.` : `It is widely argued that ${recipe.claim}.`;
      const lead = { OP: 'In my opinion, this is entirely justified', AD: 'I firmly agree with this view', EX: 'I largely agree with this view' }[t];
      P.intro = `${open} ${lead}, ${odd ? 'as' : 'since'} ${reasons(cards, lib)}. I will outline my two main reasons below.`;
      P.body1 = body(cards[0], lib, recipe, first);
      P.body2 = body(cards[1], lib, recipe, second);
      P.concl = odd
        ? `To sum up, I firmly maintain that ${recipe.claim}, chiefly because of ${shorts(cards, lib)}.`
        : `In conclusion, I remain convinced that ${recipe.claim}, given the importance of ${shorts(cards, lib)}.`;
      break;
    }
    case 'DISAGREE': {
      const open = odd ? `It is sometimes suggested that ${recipe.claim}.` : `Some people claim that ${recipe.claim}.`;
      const lead = { OP: 'I do not share this view', AD: 'I disagree with this view', EX: 'I strongly disagree with this view' }[t];
      P.intro = `${open} ${lead}, ${odd ? 'as' : 'since'} ${reasons(cards, lib)}. I will explain my two main reasons below.`;
      P.body1 = body(cards[0], lib, recipe, first);
      P.body2 = body(cards[1], lib, recipe, second);
      P.concl = odd
        ? `All things considered, I remain unconvinced that ${recipe.claim}, mainly because of ${shorts(cards, lib)}.`
        : `In conclusion, I cannot accept that ${recipe.claim}, given the weight of ${shorts(cards, lib)}.`;
      break;
    }
    case 'BOTH': {
      P.intro = odd
        ? `People hold different views on whether ${recipe.view1} or ${recipe.view2}. This essay will consider both perspectives before explaining my own opinion.`
        : `Opinions are divided as to whether ${recipe.view1} or whether ${recipe.view2}. This essay will consider both perspectives before explaining my own opinion.`;
      P.body1 = body(cards[0], lib, recipe, 'On the one hand,');
      P.body2 = body(cards[1], lib, recipe, 'On the other hand,');
      P.concl = `To sum up, both positions have their merits; nevertheless, I believe that ${recipe.own}.`;
      break;
    }
    case 'ADVDIS': {
      const topicCap = upperFirst(recipe.topic);
      const verdict = recipe.verdict === 'outweigh'
        ? 'In my opinion, the advantages clearly outweigh the disadvantages.'
        : 'In my view, the drawbacks outweigh the benefits.';
      P.intro = `${topicCap} has become increasingly common, but it brings drawbacks as well as benefits. ${verdict} This essay will examine both sides.`;
      P.body1 = body(cards[0], lib, recipe, 'On the positive side,');
      P.body2 = body(cards[1], lib, recipe, 'On the negative side,');
      P.concl = recipe.verdict === 'outweigh'
        ? `In conclusion, despite ${lib.cards[cards[1].id].short}, ${recipe.topic} is, on balance, more beneficial than harmful, thanks to ${lib.cards[cards[0].id].short}, which is why I regard it as a worthwhile development.`
        : `In conclusion, although ${recipe.topic} offers ${lib.cards[cards[0].id].short}, its drawbacks are more serious, since ${cards[1].act} ${lib.cards[cards[1].id].pred}.`;
      break;
    }
    case 'BENEFITS': {
      P.intro = `${recipe.lead} ${odd ? `In this essay, I will explain two principal benefits of ${recipe.topic}.` : `This essay will outline two key ways in which ${recipe.topic} makes a positive difference.`}`;
      P.body1 = body(cards[0], lib, recipe, first);
      P.body2 = body(cards[1], lib, recipe, second);
      P.concl = odd
        ? `To sum up, there are compelling reasons to value ${recipe.topic}, namely ${shorts(cards, lib)}. For these reasons, it deserves sustained public support.`
        : `In conclusion, ${recipe.topic} brings clear benefits, above all ${shorts(cards, lib)}. For these reasons, it deserves sustained public support.`;
      break;
    }
    case 'CAUSESOL': {
      const [k1, k2, s1, s2] = cards;
      P.intro = `The issue of ${recipe.problem} is ${odd ? 'a matter of growing concern' : 'a growing concern in many countries'}. This essay will ${odd ? 'analyse the principal causes and propose realistic solutions' : 'examine its main causes and suggest practical solutions'}.`;
      P.body1 = `${body(k1, lib, recipe, null, { ex: false, n: 3 })} ${body(k2, lib, recipe, 'In addition,', { ex: false, n: 3, problem: 'this problem' })}`;
      P.body2 = `${body(s1, lib, recipe, 'To address this issue,', { ex: false, n: 3 })} ${body(s2, lib, recipe, 'In addition,', { ex: false, n: 3 })}`;
      P.concl = `In conclusion, the issue of ${recipe.problem} stems mainly from ${lib.cards[k1.id].short} and ${lib.cards[k2.id].short}, but ${lib.cards[s1.id].short} and ${lib.cards[s2.id].short} offer a realistic way forward.`;
      break;
    }
    case 'SOLUTIONS': {
      const [s1, s2, s3, s4] = cards;
      P.intro = `${recipe.lead} This essay will suggest several practical measures.`;
      P.body1 = `${body(s1, lib, recipe, 'To address this issue,', { ex: false, n: 3 })} ${body(s2, lib, recipe, 'In addition,', { ex: false, n: 3 })}`;
      P.body2 = `${body(s3, lib, recipe, 'Equally important,', { ex: false, n: 3 })} ${body(s4, lib, recipe, 'Finally,', { ex: false, n: 3 })}`;
      P.concl = `In conclusion, ${lib.cards[s1.id].short}, ${lib.cards[s2.id].short}, ${lib.cards[s3.id].short} and ${lib.cards[s4.id].short} together offer the most realistic way forward.`;
      break;
    }
    default:
      throw new Error(`Shape khong ho tro: ${recipe.shape}`);
  }

  const paragraphs = [P.intro, P.body1, P.body2, P.concl];
  const text = paragraphs.join('\n\n');
  if (/[{}]/.test(text)) throw new Error(`Con slot chua dien trong recipe ${recipe.id}`);
  return { paragraphs, text, words: text.trim().split(/\s+/).length, cardIds: cards.map((c) => c.id) };
}
