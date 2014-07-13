MOCHA_OPTS= --check-leaks
REPORTER = spec

test:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--globals setImmediate,clearImmediate \
		$(MOCHA_OPTS)

test-box:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		test/box.js

test-directory:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		test/directory.js

test-item:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		test/item.js

run: 
	DEBUG=* node test/run.js

.PHONY: test test-box test-directory test-item run
