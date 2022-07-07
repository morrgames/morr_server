'use strict';
const path = require('path');
const fs = require('fs');

module.exports = {
  load: async function (func_list) {
    const ref_list = fs.readdirSync('reference');
    _.pull(ref_list, 'index.js', '.svn');

    for (const str of ref_list) {
      const ref_name = path.basename(str, '.js');
      const ref_module = require('reference/' + ref_name);
      const basename = ref_name.slice(4, ref_name.length);

      this[basename] = ref_module;

      const ret_err = await this[basename].load(this);
      if (ret_err) throw ret_err;
    }

    if (func_list) {
      for (const func of func_list) {
        await func();
      }
    }

    //const under = this.betgolds.get_under(110001001, 322222, 0);
  },
};
