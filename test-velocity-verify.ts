import { evaluateVelocityExpression } from './src/utils/velocity';
try {
    const maliciousTemplate = '#set($c = "con" + "structor")\n$a[$c]';
    console.log("Evaluating:", maliciousTemplate);
    const result = evaluateVelocityExpression(maliciousTemplate, { a: { constructor: 'hacked' } });
    console.log("Result:", result);
} catch (e: any) {
    console.log("Error:", e.message);
}
