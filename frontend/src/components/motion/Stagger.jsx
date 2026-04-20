import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from './variants';

/**
 * <Stagger> — Container that orchestrates staggered animations of children.
 *
 * Wrap a list/grid of items in <Stagger>, and wrap each child in <Stagger.Item>
 * (or any motion element with `variants={staggerItem}`).
 *
 * @param {number} stagger   Delay between each child (seconds). Default 0.08.
 * @param {number} delay     Initial delay before first child (seconds). Default 0.05.
 * @param {boolean} whileInView Trigger when scrolled into view. Default true.
 */
function Stagger({
  children,
  stagger = 0.08,
  delay = 0.05,
  whileInView = true,
  as = 'div',
  className = '',
  ...rest
}) {
  const MotionTag = motion[as] || motion.div;
  const variants = staggerContainer({ stagger, delay });

  const viewProps = whileInView
    ? { initial: 'hidden', whileInView: 'visible', viewport: { once: true, amount: 0.1 } }
    : { initial: 'hidden', animate: 'visible' };

  return (
    <MotionTag className={className} variants={variants} {...viewProps} {...rest}>
      {children}
    </MotionTag>
  );
}

/**
 * <Stagger.Item> — Convenience wrapper for a child of <Stagger>.
 * Reads the orchestrating parent's `staggerChildren` automatically.
 */
function StaggerItem({ children, as = 'div', className = '', ...rest }) {
  const MotionTag = motion[as] || motion.div;
  return (
    <MotionTag className={className} variants={staggerItem} {...rest}>
      {children}
    </MotionTag>
  );
}

Stagger.Item = StaggerItem;

export default Stagger;
