// inject.js - Lightning Navigation Handler for SF Tabs
// This file is injected into the page to access Salesforce's Lightning navigation APIs

document.addEventListener("lightningNavigate", (event) => {
    handleLightningNavigation(event.detail);
});

function handleLightningNavigation(details) {
    try {
        switch (details.navigationType) {
            case "url":
                navigateToURL(details.url);
                break;
            case "recordId":
                navigateToSObject(details.recordId);
                break;
            default:
                throw new Error("Invalid navigation type");
        }
    } catch (error) {
        console.error("Lightning navigation failed, falling back to default navigation:", error.message);
        // Fallback to regular navigation
        if (details.fallbackURL) {
            window.open(details.fallbackURL, "_top");
        }
    }

    function navigateToURL(url) {
        if (typeof $A !== 'undefined' && $A.get) {
            const e = $A.get("e.force:navigateToURL");
            if (e) {
                e.setParams({ url: url });
                e.fire();
                return;
            }
        }
        throw new Error("Lightning navigation not available");
    }

    function navigateToSObject(recordId) {
        if (typeof $A !== 'undefined' && $A.get) {
            const e = $A.get("e.force:navigateToSObject");
            if (e) {
                e.setParams({ "recordId": recordId });
                e.fire();
                return;
            }
        }
        throw new Error("Lightning navigation not available");
    }
}