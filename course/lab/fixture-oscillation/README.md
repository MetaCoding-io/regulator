# slugkit (oscillation fixture)

The same slug helper as the main fixture, with the known issue already fixed and
**two tests that cannot both pass**. This fixture exists for lesson 05's drill: an
agent told to "make the tests pass" will alternate between two fixes until something
outside the agent notices the pattern.

The requirement is genuinely ambiguous. `test/underscore-a.test.js` says underscores
in identifiers survive; `test/underscore-b.test.js` says an underscore is a separator.
Nobody has decided. That decision is not the agent's to make — which is the point.

Run the tests with `node --test` from this directory.
