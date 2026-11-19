using {arportal as db} from '../db/schema';

@requires: 'PortalAdmin'
service AdminService {
    @odata.draft.enabled
    entity UserAssignments as projection on db.UserAssignments;
}
