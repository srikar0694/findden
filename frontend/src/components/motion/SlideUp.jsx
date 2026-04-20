import { motion } from 'framer-motion';
import { slideUp } from './variants';

/**
 * <SlideUp> — element fades in while translating up from below.
 * Use for hero titles, section intros, empty states, etc.
 *
 * @param {number}  delay       Delay before animation (seconds).
 * @param {number}  distance    How far below to start (pixels). Default 32.
 * @param {boolean} whileInView Trigger on scroll-into-view if true.
 */
export default function SlideUp({
  children,
  delay = 0,
  distance = 32,
  whileInView = true,
  as = 'div',
  className = '',
  ...rest
}) {
  const MotionTag = motion[as] || motion.div;

  const variants = {
    ...slideUp,
    hidden: { ...slideUp.hidden, y: distance },
  };

  const viewProps = whileInView
    ? { initial: 'hidden', whileInView: 'visible', viewport: { once: true, amount: 0.2 } }
    : { initial: 'hidden', animate: 'visible' };

  return (
    <MotionTag
      className={className}
      variants={variants}
      transition={{ delay }}
      {...viewProps}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}
