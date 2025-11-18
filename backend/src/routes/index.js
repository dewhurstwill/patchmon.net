const authRoutes = require("./routes/authRoutes");
const hostRoutes = require("./routes/hostRoutes");
const hostGroupRoutes = require("./routes/hostGroupRoutes");
const packageRoutes = require("./routes/packageRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const permissionsRoutes = require("./routes/permissionsRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const {
	router: dashboardPreferencesRoutes,
} = require("./routes/dashboardPreferencesRoutes");
const repositoryRoutes = require("./routes/repositoryRoutes");
const versionRoutes = require("./routes/versionRoutes");
const tfaRoutes = require("./routes/tfaRoutes");
const searchRoutes = require("./routes/searchRoutes");
const autoEnrollmentRoutes = require("./routes/autoEnrollmentRoutes");
const gethomepageRoutes = require("./routes/gethomepageRoutes");
const automationRoutes = require("./routes/automationRoutes");
const dockerRoutes = require("./routes/dockerRoutes");
const integrationRoutes = require("./routes/integrationRoutes");
const wsRoutes = require("./routes/wsRoutes");
const agentVersionRoutes = require("./routes/agentVersionRoutes");
const metricsRoutes = require("./routes/metricsRoutes");
const userPreferencesRoutes = require("./routes/userPreferencesRoutes");
const apiHostsRoutes = require("./routes/apiHostsRoutes");

module.exports = {
	authRoutes,
	hostRoutes,
	hostGroupRoutes,
	packageRoutes,
	dashboardRoutes,
	permissionsRoutes,
	settingsRoutes,
	dashboardPreferencesRoutes,
	repositoryRoutes,
	versionRoutes,
	tfaRoutes,
	searchRoutes,
	autoEnrollmentRoutes,
	gethomepageRoutes,
	automationRoutes,
	dockerRoutes,
	integrationRoutes,
	wsRoutes,
	agentVersionRoutes,
	metricsRoutes,
	userPreferencesRoutes,
	apiHostsRoutes,
};
