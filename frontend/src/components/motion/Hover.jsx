import { motion } from 'framer-motion';
import { cardHover, liftHover, softPop } from './variants';

const PRESETS = {
  card: cardHover,
  lift: liftHover,
};

/**
 * <Hover> — wraps a child with a hover/tap micro-interaction using variants.
 *
 * Presets:
 *   - "card" : lifts + shadows on hover (for property cards, tiles, plans)
 *   - "lift" : small vertical lift (for buttons, icons)
 *   - "pop"  : small scale pop (default; great for links)
 *
 * @param {"card"|"lift"|"pop"} preset   Which hover behaviour to use.
 * @param {string}              as        HTML tag to render.
 */
export default function Hover({
  children,
  preset = 'pop',
  as = 'div',
  className = '',
  ...rest
}) {
  const MotionTag = motion[as] || motion.div;

  if (preset === 'pop') {
    return (
      <MotionTag className={className} {...softPop} {...rest}>
        {children}
      </MotionTag>
    );
  }

  const variants = PRESETS[preset] || cardHover;

  return (
    <MotionTag
      className={className}
      variants={variants}
      initial="rest"
      whileHover="hover"
      whileTap="tap"
      animate="rest"
      {...rest}
    >
      {children}
    </MotionTag>
  );
}
