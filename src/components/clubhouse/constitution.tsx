"use client";

import { POOL_CONSTITUTION } from "@/components/commissioner-handbook";

/**
 * The pool's constitution, posted in full: the very text the Commissioner Handbook holds, so the two can never differ. Quick to use:
 * a row of the ten articles at the top jumps straight to one, each article is a short numbered list, and the three parts are headed
 * like the sections of a printed rule book.
 */
export function Constitution() {
  const articles = POOL_CONSTITUTION.flatMap(({ articles: list }) => list);
  const idFor = (title: string) => `rule-${title.split(" · ")[0].split(" ")[1].toLowerCase()}`;
  return (
    <article aria-label="Pool constitution" className="lab-rules">
      <header>
        <p>THE JOE BARR MEMORIAL PICK’EM</p>
        <h4>Pool Constitution</h4>
      </header>
      <div className="lab-rules-body">
      <nav aria-label="Articles" className="lab-rules-index">
        {articles.map(({ title }) => {
          const [number, name] = title.split(" · ");
          return <a href={`#${idFor(title)}`} key={title} onClick={(event) => { event.preventDefault(); document.getElementById(idFor(title))?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><b>{number.replace("Article ", "")}</b>{name}</a>;
        })}
      </nav>
      {POOL_CONSTITUTION.map(({ part, articles: list }) => (
        <section aria-label={part} className="lab-rules-part" key={part}>
          <h5>{part}</h5>
          {list.map(({ title, clauses }) => {
            const [number, name] = title.split(" · ");
            return (
              <section aria-labelledby={`${idFor(title)}-title`} className="lab-rules-article" id={idFor(title)} key={title}>
                <h6 id={`${idFor(title)}-title`}><span>{number}</span>{name}</h6>
                <ol>{clauses.map((clause) => <li key={clause}>{clause}</li>)}</ol>
              </section>
            );
          })}
        </section>
      ))}
      </div>
    </article>
  );
}
