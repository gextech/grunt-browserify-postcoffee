module.exports = function(grunt) {
  var _ = grunt.util._,
      path = require('path');

  grunt.registerMultiTask('postcoffee', 'Combine already generated .coffee source-maps from browserify bundle', function() {

    var options = this.options({
      cwd: ''
    });

    _.each(this.files, function(file) {
      fixSourceMaps(file.src, file.dest, options);
    });
  });


  var isModule = function(str) {
    return /:\[function\(require,module,exports\)\{$/.test(str);
  };

  var isSourceMap = function(str) {
    return /\/\/[#@] sourceMappingURL=\S+/.test(str);
  };

  var getSourceParams = function(str, cwd) {
    var params = {},
        source_js, source_coffee,
        source_map = process.cwd() + '/' + (str.split('sourceMappingURL=')[1].replace(/\.\.\//g, ''));

    params.source_map = grunt.file.readJSON(source_map);

    source_coffee = path.resolve(path.dirname(source_map), params.source_map.sourceRoot + params.source_map.sources[0]);
    source_js = source_map.substr(0, source_map.length - 4);

    params.source_map.sourceRoot = '';
    params.source_map.sourcesContent = [grunt.file.read(source_coffee)];
    params.source_map.sources[0] = source_coffee.replace(process.cwd() + (cwd ? '/' + cwd : ''), '');

    params.source_coffee = source_coffee;
    params.source_js = source_js;

    return params;
  };

  var fixSourceMaps = function(src, dest, options) {
    if (!String(src)) {
      return;
    }

    var convert = require('convert-source-map'),
        combine = require('combine-source-map');

    var filepath = String(src),
        filename = filepath.split('/').pop(),
        bundle_js = grunt.file.read(filepath);

    if (bundle_js.indexOf('=' + filename + '.map') !== -1) {
      grunt.log.warn('File "' + filepath + '" already post-coffeed.');
      return;
    }

    var bundle_lines = bundle_js.replace(/\s+$/).split('\n'),
        source_comment, source_lines,
        current = -1,
        bundled = [];

    var lines = bundle_lines.slice(0, -1),
        length = lines.length,
        offset = 0,
        params;

    var bundle = combine.create(filename);

    for (; offset < length; offset += 1) {
      if (isModule(lines[offset])) {
        current += 1;
        bundled[current] = { line: offset + 1 };
      } else if (current > -1) {
        if (isSourceMap(lines[offset])) {
          params = getSourceParams(lines[offset], options.cwd);

          source_comment = convert.fromObject(params.source_map).toComment();
          source_lines = grunt.file.read(params.source_js).split('\n');
          source_lines[source_lines.length - 2] = source_comment;

          bundle.addFile({
            source: source_lines.join('\n'),
            sourceFile: params.source_coffee
          }, bundled[current]);

          bundle_lines[offset] = '/* ' + params.source_coffee + ' */';

          grunt.log.ok('File "' + params.source_js.replace(process.cwd() + '/', '') + '.map" was added.');
        }
      }
    }

    bundle_lines.push('//# sourceMappingURL=' + filename + '.map');

    grunt.file.write(filepath + '.map', convert.fromBase64(bundle.base64()).toJSON(2));
    grunt.log.ok('File "' + filepath + '.map" was created.');

    grunt.file.write(filepath, bundle_lines.join('\n'));
    grunt.log.ok('File "' + filepath + '" was updated.');
  };
};
