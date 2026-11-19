import JourneyRunner from "sap/fe/test/JourneyRunner";
import ListReport from "sap/fe/test/ListReport";
import ObjectPage from "sap/fe/test/ObjectPage";
import CustomUserAssignmentsListGenerated from "./UserAssignmentsList.gen";
import CustomUserAssignmentsObjectPageGenerated from "./UserAssignmentsObjectPage.gen";

const runner = new JourneyRunner({
    launchUrl: sap.ui.require.toUrl("arportal/adminassignments") + "/test/flp.html#app-preview",
    pages: {
        onTheUserAssignmentsListGenerated: new ListReport(
            {
                appId: "arportal.adminassignments",
                componentId: "UserAssignmentsList",
                entitySet: "",
                contextPath: "/UserAssignments"
            },
            CustomUserAssignmentsListGenerated
        ),
        onTheUserAssignmentsObjectPageGenerated: new ObjectPage(
            {
                appId: "arportal.adminassignments",
                componentId: "UserAssignmentsObjectPage",
                entitySet: "",
                contextPath: "/UserAssignments"
            },
            CustomUserAssignmentsObjectPageGenerated
        )
    },
    async: true
});

export default runner;
