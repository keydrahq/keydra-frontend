// Relative rather than aliased: an alias is read from tsconfig when the dev server starts,
// so adding one for a handful of files would mean every running server had to be restarted
// before it could resolve them.
import redis from '../../assets/logos/redis.svg';
import valkey from '../../assets/logos/valkey.svg';
import keydb from '../../assets/logos/keydb.svg';
import dragonfly from '../../assets/logos/dragonfly.svg';
// A bitmap among the vector ones, because Garnet publishes no SVG of its mark. Cropped to the
// mark and scaled to well over the size it is drawn at, so it stays crisp where the others are
// resolution-free.
import garnet from '../../assets/logos/garnet.png';
import aerospike from '../../assets/logos/aerospike.svg';
import tikv from '../../assets/logos/tikv.svg';

/**
 * The mark that stands for a server, or nothing when the target would not say what it runs.
 *
 * <p>Keyed on the flavour the server reported rather than on anything Keydra chose, so a fork that
 * answers "redis" is drawn as Redis because that is what it says it is. A flavour with no mark here
 * gets none at all — a wrong logo is worse than none, and the caller has a plain server glyph for
 * it.
 *
 * <p>The files and where they come from are in src/assets/logos/README.md. They are the projects'
 * own marks, used to name those projects.
 */
export const serverLogo = (flavor: string | null | undefined): string | undefined => {
  switch (flavor) {
    case 'redis':
      return redis;
    case 'valkey':
      return valkey;
    case 'keydb':
      return keydb;
    case 'dragonfly':
      return dragonfly;
    case 'garnet':
      return garnet;
    case 'aerospike':
      return aerospike;
    case 'tikv':
      return tikv;
    default:
      return undefined;
  }
};

/**
 * How a server's name is written.
 *
 * <p>Products are proper nouns, and PatternFly's content standards keep a proper noun's own
 * capitalisation inside sentence-cased interface text. The wire value is whatever the server
 * answered — lowercase, because that is how a Redis INFO block spells it — and that is a fact about
 * the protocol rather than about how the name is written down.
 */
export const serverName = (flavor: string | null | undefined): string => {
  switch (flavor) {
    case 'redis':
      return 'Redis';
    case 'valkey':
      return 'Valkey';
    // Its own capitalisation, which the fallback below would not arrive at: a server answering
    // "keydb" would be shown as "Keydb", and a product's name is not ours to tidy up.
    case 'keydb':
      return 'KeyDB';
    case 'dragonfly':
      return 'Dragonfly';
    case 'garnet':
      return 'Garnet';
    case 'aerospike':
      return 'Aerospike';
    // Its own capitalisation, which the fallback would not reach: a target answering "tikv"
    // would be shown as "Tikv", and a product's name is not ours to tidy up.
    case 'tikv':
      return 'TiKV';
    default:
      // A flavour nobody has named here is shown as the server spelled it, capitalised: it is
      // still a product name, and inventing a spelling for it would be worse than the server's.
      return flavor ? flavor.charAt(0).toUpperCase() + flavor.slice(1) : '';
  }
};
