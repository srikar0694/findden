import { motion } from 'framer-motion';
import { fadeIn } from './variants';

/**
 * <FadeIn> — declarative fade-in wrapper.
 *
 * @param {number}  delay      Delay in seconds before the animation starts.
 * @param {number}  duration   Duration override (seconds).
 * @param {boolean} whileInView If true, triggers when scrolled into view.
 * @param {string}  as         HTML tag to render ("div" by default).
 */
export default function FadeIn({
  children,
  delay = 0,
  duration,
  whileInView = false,
  as = 'div',
  className = '',
  ...rest
}) {
  const MotionTag = motion[as] || motion.div;

  const variants = duration
    ? {
        ...fadeIn,
        visible: { ...fadeIn.visible, transition: { ...fadeIn.visible.transition, duration } },
      }
    : fadeIn;

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
