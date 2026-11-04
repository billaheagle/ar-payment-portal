import JourneyRunner from 'sap/fe/test/JourneyRunner';
import ListReport from 'sap/fe/test/ListReport';
import ObjectPage from 'sap/fe/test/ObjectPage';
import CustomOpenItemsListGenerated from './OpenItemsList.gen';
import CustomOpenItemsObjectPageGenerated from './OpenItemsObjectPage.gen';

const runner = new JourneyRunner({
  launchUrl: sap.ui.require.toUrl('arportal/openitems') + '/test/flp.html#app-preview',
  pages: {
    onTheOpenItemsListGenerated: new ListReport(
      {
        appId: 'arportal.openitems',
        componentId: 'OpenItemsList',
        entitySet: '',
        contextPath: '/OpenItems',
      },
      CustomOpenItemsListGenerated,
    ),
    onTheOpenItemsObjectPageGenerated: new ObjectPage(
      {
        appId: 'arportal.openitems',
        componentId: 'OpenItemsObjectPage',
        entitySet: '',
        contextPath: '/OpenItems',
      },
      CustomOpenItemsObjectPageGenerated,
    ),
  },
  async: true,
});

export default runner;
