// Discussion-specific vote queries and writes, separated from the general API
// dispatcher so score calculation and vote replacement stay consistent.
import { one, run, transaction } from './db.mjs';
import { Problem, requireUser } from './auth.mjs';
import * as v from './validation.mjs';

export function voteColumns(kind, alias) {
  const key = kind === 'post' ? 'post_id' : 'comment_id';
  const table = kind === 'post' ? 'post_votes' : 'comment_votes';
  return `(SELECT coalesce(sum(value),0) FROM ${table} WHERE ${key}=${alias}.id) AS score,
    coalesce((SELECT \`value\` FROM ${table} WHERE ${key}=${alias}.id AND user_id=?),0) AS myVote`;
}

export async function changeVote(d, me) {
  requireUser(me);
  const kind = v.choice(d.kind, ['post', 'comment'], 'vote target');
  const id = v.id(d.id);
  if (![1, -1, 0].includes(d.value)) throw new Problem('Choose upvote, downvote, or remove vote.');
  const table = kind === 'post' ? 'post_votes' : 'comment_votes';
  const key = kind === 'post' ? 'post_id' : 'comment_id';
  return transaction(async () => {
    const target =
      kind === 'post'
        ? await one("SELECT id FROM posts WHERE id=? AND status='published'", id)
        : await one(
            "SELECT c.id FROM comments c JOIN posts p ON p.id=c.post_id WHERE c.id=? AND c.status='published' AND p.status='published'",
            id,
          );
    if (!target) throw new Problem('Published discussion content not found.', 404);
    if (d.value === 0) await run(`DELETE FROM ${table} WHERE ${key}=? AND user_id=?`, id, me.id);
    else
      await run(
        `INSERT INTO ${table}(${key},user_id,\`value\`) VALUES(?,?,?) ON DUPLICATE KEY UPDATE \`value\`=VALUES(\`value\`)`,
        id,
        me.id,
        d.value,
      );
    return {
      score: (
        await one(`SELECT coalesce(sum(\`value\`),0) AS score FROM ${table} WHERE ${key}=?`, id)
      ).score,
      myVote: d.value,
    };
  });
}
