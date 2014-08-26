
test:
	@./node_modules/.bin/mocha \
		--reporter spec \
		--require should \
		--slow 2500ms \
		--timeout 30s \
		--bail \
		$(ARGS)

test-node:
	@make test ARGS=test/nodes/node.js

.PHONY: test test-node
