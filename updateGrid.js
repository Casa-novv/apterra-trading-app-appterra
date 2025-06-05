const fs = require('fs');
const path = require('path');

const directoryPath = './src'; // Adjust this if needed

function updateFiles(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            updateFiles(fullPath); // Recursively scan subdirectories
        } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.jsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');

            // Replace `item xs={X} sm={Y} md={Z}` with `size={{ xs: X, sm: Y, md: Z }}`
            content = content.replace(/item\s+xs={(\d+)}\s+sm={(\d+)}\s+md={(\d+)}/g, 'size={{ xs: $1, sm: $2, md: $3 }}');

            // Replace `item xs={X} lg={Y}` with `size={{ xs: X, lg: Y }}`
            content = content.replace(/item\s+xs={(\d+)}\s+lg={(\d+)}/g, 'size={{ xs: $1, lg: $2 }}');

            // Replace `item md={X} lg={Y}` with `size={{ md: X, lg: Y }}`
            content = content.replace(/item\s+md={(\d+)}\s+lg={(\d+)}/g, 'size={{ md: $1, lg: $2 }}');

            // Replace `item xs={X} md={Y}` with `size={{ xs: X, md: Y }}`
            content = content.replace(/item\s+xs={(\d+)}\s+md={(\d+)}/g, 'size={{ xs: $1, md: $2 }}');

            // Replace `item sm={X} lg={Y}` with `size={{ sm: X, lg: Y }}`
            content = content.replace(/item\s+sm={(\d+)}\s+lg={(\d+)}/g, 'size={{ sm: $1, lg: $2 }}');

            // Replace `item xl={X}` with `size={{ xl: X }}`
            content = content.replace(/item\s+xl={(\d+)}/g, 'size={{ xl: $1 }}');

            // Replace `item xs={X} sm={Y}` with `size={{ xs: X, sm: Y }}`
            content = content.replace(/item\s+xs={(\d+)}\s+sm={(\d+)}/g, 'size={{ xs: $1, sm: $2 }}');

            // Replace `item xs={X}` with `size={{ xs: X }}`
            content = content.replace(/item\s+xs={(\d+)}/g, 'size={{ xs: $1 }}');

            fs.writeFileSync(fullPath, content, 'utf8');
            console.log(`Updated: ${fullPath}`);
        }
    });
}

updateFiles(directoryPath);
