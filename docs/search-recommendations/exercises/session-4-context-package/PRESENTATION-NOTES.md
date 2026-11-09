# Five-minute presentation

## 1. Our module — 0:00 to 0:45

We are the Search & Recommendations team. We provide APIs; Storefront builds the customer interface. Our full scope includes search, filters, facets, autocomplete and recommendations. For this exercise, we chose one small task: searching fictional products by name, category and price. We did not build the entire system.

## 2. Why the interface review matters — 0:45 to 1:45

The review exposed a real mismatch. Admin proposed articles with article_id, category_id, tags and is_published. Marketplace proposed products and offers with productId, category, attributes and status. Both had assumptions about the product data. A joint chat was created to settle ownership and shared IDs. Product and article appear to describe the same concept; an offer adds seller terms, price and availability. That is a working interpretation, not yet a complete agreement. Our revised context records both proposals. We have updated our document, but still need agreement and confirmation that the partner documents are updated too.

## 3. Our experiment — 1:45 to 2:30

We ran two fresh Codex sessions with the same model, reasoning settings, task and six fictional products. Run A had the task only. Run B also had the original 663-token module briefing. The runs happened before the latest team replies. We kept their original code and context, then ran the same 18 independent checks. The current revised module is not the one used in that historical experiment.

## 4. What changed — 2:30 to 4:00

Both runs passed all 18 independent checks and TypeScript checking. A wrote 14 passing tests and B wrote 13; those counts do not establish which test suite is better. Both used three assistant messages, five commands and one file-change batch, with no human corrections. The clearest difference was interface alignment. A used query and products; B used the module's q and items. B also used kebab-case files, Zod and an explicit EUR type. A had not seen those conventions, so we do not call its choices functional failures. Both outputs are standalone functions, not complete HTTP APIs.

## 5. Conclusion — 4:00 to 5:00

For this pair, context helped the agent follow our conventions, but it did not change the common functional pass rate or reduce messages and commands. One pair cannot prove a general improvement or cost saving. Our review also showed that an agent can follow a provisional context correctly even when teams have not agreed the underlying contract. The next step is to close that agreement and keep the context current. For recurring tasks, we chose workflows for index refresh, routing for intent classification, prompt chaining for synonyms, evaluator-and-optimizer for ranking refinement, and an agent for open-ended debugging.
