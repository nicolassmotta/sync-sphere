import { motion } from 'framer-motion';

const fadeInPageVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
};

const FadeInPage = ({ children, className }) => (
    <motion.div variants={fadeInPageVariants} initial="hidden" animate="visible" className={className}>
        {children}
    </motion.div>
);

export default FadeInPage;
