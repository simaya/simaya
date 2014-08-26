
test:
	@./node_modules/.bin/mocha \
		--async-only \
		--reporter spec \
		--slow 10000ms \
		--timeout 30s \
		test/*

test-partial:
	@./node_modules/.bin/mocha \
		--async-only \
		--reporter spec \
		--slow 10000ms \
		--timeout 30s \
		$(ARGS)
		
test-letter:
	@make test-partial ARGS=test/letter.js

test-node:
	@make test-partial ARGS=test/nodes/node.js

.PHONY: test test-node
